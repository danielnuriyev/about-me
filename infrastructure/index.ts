import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// Create an S3 bucket for static website hosting
const siteBucket = new aws.s3.Bucket("dn-about-me", {
    website: {
        indexDocument: "index.html",
    },
});

// Custom Domain Configuration
const domainName = "danielnuriyev.info";
const apiDomainName = `api.${domainName}`;
const wwwDomainName = `www.${domainName}`;

// Get existing Route 53 Hosted Zone
const hostedZone = aws.route53.getZone({ name: domainName });

// Create ACM Certificate for the domain and subdomains
const certificate = new aws.acm.Certificate("site-cert", {
    domainName: domainName,
    validationMethod: "DNS",
    subjectAlternativeNames: [wwwDomainName, apiDomainName],
    tags: {
        Project: "about-me",
    },
});

// Create DNS records for validation (all domains)
const certValidationRecords = certificate.domainValidationOptions.apply(options =>
    options.map((option, index) =>
        new aws.route53.Record(`cert-validation-${index}`, {
            name: option.resourceRecordName,
            type: option.resourceRecordType,
            zoneId: hostedZone.then(zone => zone.zoneId),
            records: [option.resourceRecordValue],
            ttl: 60,
        })
    )
);

// Validate the certificate
const certValidation = new aws.acm.CertificateValidation("cert-validation", {
    certificateArn: certificate.arn,
    validationRecordFqdns: certValidationRecords.apply(records => records.map(record => record.fqdn)),
});

// Create a CloudFront Origin Access Identity
const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity("about-me-oai", {
    comment: "OAI for about-me S3 bucket",
});

// Create a bucket policy to allow CloudFront to access the S3 bucket
const bucketPolicy = new aws.s3.BucketPolicy("about-me-bucket-policy", {
    bucket: siteBucket.id,
    policy: pulumi.all([siteBucket.arn, originAccessIdentity.iamArn]).apply(([bucketArn, oaiArn]) =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        AWS: oaiArn,
                    },
                    Action: "s3:GetObject",
                    Resource: `${bucketArn}/*`,
                },
            ],
        })
    ),
});

// Create a CloudFront distribution
const cdn = new aws.cloudfront.Distribution("about-me-cdn", {
    defaultRootObject: "index.html", // Serve index.html for SPA routing
    origins: [
        {
            domainName: siteBucket.bucketRegionalDomainName,
            originId: "S3-dn-about-me",
            s3OriginConfig: {
                originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath,
            },
        },
    ],
    enabled: true,
    isIpv6Enabled: true,
    defaultCacheBehavior: {
        targetOriginId: "S3-dn-about-me",
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD"],
        forwardedValues: {
            queryString: false,
            cookies: {
                forward: "none",
            },
        },
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
    },
    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },
    viewerCertificate: {
        acmCertificateArn: certificate.arn,
        sslSupportMethod: "sni-only",
        minimumProtocolVersion: "TLSv1.2_2021",
    },
    aliases: [domainName, wwwDomainName],
});

// Create IAM role for Lambda
const lambdaRole = new aws.iam.Role("about-me-lambda-role", {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Action: "sts:AssumeRole",
                Principal: {
                    Service: "lambda.amazonaws.com",
                },
                Effect: "Allow",
                Sid: "",
            },
        ],
    }),
});

// Attach basic execution role to Lambda
const lambdaRoleAttachment = new aws.iam.RolePolicyAttachment("about-me-lambda-role-attachment", {
    role: lambdaRole.name,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});

// Create IAM policy for Bedrock access
const bedrockPolicy = new aws.iam.Policy("bedrock-policy", {
    policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Action: [
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream"
                ],
                Resource: "*"
            }
        ]
    })
});

// Create IAM role for Chat Lambda
const chatLambdaRole = new aws.iam.Role("about-me-chat-lambda-role", {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Action: "sts:AssumeRole",
                Principal: {
                    Service: "lambda.amazonaws.com",
                },
                Effect: "Allow",
                Sid: "",
            },
        ],
    }),
});

// Attach basic execution role and Bedrock policy to Chat Lambda
const chatLambdaRoleAttachment = new aws.iam.RolePolicyAttachment("about-me-chat-lambda-role-attachment", {
    role: chatLambdaRole.name,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});

const chatBedrockPolicyAttachment = new aws.iam.RolePolicyAttachment("about-me-chat-bedrock-policy-attachment", {
    role: chatLambdaRole.name,
    policyArn: bedrockPolicy.arn,
});

// Create DynamoDB table for chat conversation logging
const chatLogsTable = new aws.dynamodb.Table("chat-conversations", {
    attributes: [
        { name: "conversationId", type: "S" },
        { name: "timestamp", type: "S" },
        { name: "clientIP", type: "S" }
    ],
    hashKey: "conversationId",
    rangeKey: "timestamp",
    globalSecondaryIndexes: [
        {
            name: "IPIndex",
            hashKey: "clientIP",
            rangeKey: "timestamp",
            projectionType: "ALL",
        }
    ],
    billingMode: "PAY_PER_REQUEST",
});

// Create DynamoDB table for rate limiting
const rateLimitsTable = new aws.dynamodb.Table("rate-limits", {
    attributes: [
        { name: "clientIP", type: "S" }
    ],
    hashKey: "clientIP",
    billingMode: "PAY_PER_REQUEST",
    // Enable TTL for automatic cleanup of old entries
    streamViewType: "NEW_AND_OLD_IMAGES", // Required for TTL
});

// DynamoDB policy for Lambda
const dynamoPolicy = new aws.iam.Policy("chat-dynamo-policy", {
    policy: pulumi.all([chatLogsTable.arn, rateLimitsTable.arn]).apply(([chatLogsArn, rateLimitsArn]) => JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Action: [
                    "dynamodb:PutItem",
                    "dynamodb:GetItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:Query",
                    "dynamodb:Scan"
                ],
                Resource: [
                    chatLogsArn,
                    `${chatLogsArn}/index/*`,
                    rateLimitsArn
                ]
            }
        ]
    }))
});

// Attach DynamoDB policy to chat Lambda
const chatDynamoPolicyAttachment = new aws.iam.RolePolicyAttachment("chat-dynamo-policy-attachment", {
    role: chatLambdaRole.name,
    policyArn: dynamoPolicy.arn,
});

// Create Lambda function
const lambdaFunction = new aws.lambda.Function("about-me-api", {
    runtime: aws.lambda.Runtime.NodeJS18dX,
    code: new pulumi.asset.FileArchive("../backend/lambda"),
    handler: "index.handler",
    role: lambdaRole.arn,
});

// Create Chat Lambda function
const chatLambdaFunction = new aws.lambda.Function("about-me-chat-api", {
    runtime: aws.lambda.Runtime.NodeJS18dX,
    code: new pulumi.asset.FileArchive("../backend/lambda-chat"),
    handler: "index.handler",
    role: chatLambdaRole.arn,
    timeout: 30, // Longer timeout for AI responses
    reservedConcurrentExecutions: 10, // Allow more concurrent executions (API Gateway will throttle)
    environment: {
        variables: {
            CHAT_LOGS_TABLE: chatLogsTable.name,
            RATE_LIMIT_TABLE: rateLimitsTable.name,
        }
    }
});

// Create API Gateway
const api = new aws.apigateway.RestApi("about-me-api", {
    description: "API for about-me website",
});

// Create API Gateway resource
const profileResource = new aws.apigateway.Resource("profile-resource", {
    restApi: api.id,
    parentId: api.rootResourceId,
    pathPart: "profile",
});

// Create Chat API Gateway resource
const chatResource = new aws.apigateway.Resource("chat-resource", {
    restApi: api.id,
    parentId: api.rootResourceId,
    pathPart: "chat",
});

// Create API Gateway method
const profileMethod = new aws.apigateway.Method("profile-method", {
    restApi: api.id,
    resourceId: profileResource.id,
    httpMethod: "GET",
    authorization: "NONE",
});

// Create Chat API Gateway method
const chatMethod = new aws.apigateway.Method("chat-method", {
    restApi: api.id,
    resourceId: chatResource.id,
    httpMethod: "POST",
    authorization: "NONE",
});

// Create OPTIONS method for CORS
const chatOptionsMethod = new aws.apigateway.Method("chat-options-method", {
    restApi: api.id,
    resourceId: chatResource.id,
    httpMethod: "OPTIONS",
    authorization: "NONE",
});

// Create API Gateway integration
const profileIntegration = new aws.apigateway.Integration("profile-integration", {
    restApi: api.id,
    resourceId: profileResource.id,
    httpMethod: profileMethod.httpMethod,
    type: "AWS_PROXY",
    integrationHttpMethod: "POST",
    uri: lambdaFunction.invokeArn,
});

// Create Chat API Gateway integration
const chatIntegration = new aws.apigateway.Integration("chat-integration", {
    restApi: api.id,
    resourceId: chatResource.id,
    httpMethod: chatMethod.httpMethod,
    type: "AWS_PROXY",
    integrationHttpMethod: "POST",
    uri: chatLambdaFunction.invokeArn,
});

// Create OPTIONS integration for CORS
const chatOptionsIntegration = new aws.apigateway.Integration("chat-options-integration", {
    restApi: api.id,
    resourceId: chatResource.id,
    httpMethod: chatOptionsMethod.httpMethod,
    type: "MOCK",
    requestTemplates: {
        "application/json": "{\"statusCode\": 200}"
    },
});

// Create OPTIONS method response for CORS
const chatOptionsMethodResponse = new aws.apigateway.MethodResponse("chat-options-response", {
    restApi: api.id,
    resourceId: chatResource.id,
    httpMethod: chatOptionsMethod.httpMethod,
    statusCode: "200",
    responseModels: {
        "application/json": "Empty",
    },
    responseParameters: {
        "method.response.header.Access-Control-Allow-Headers": true,
        "method.response.header.Access-Control-Allow-Methods": true,
        "method.response.header.Access-Control-Allow-Origin": true,
    },
});

// Create OPTIONS integration response for CORS
const chatOptionsIntegrationResponse = new aws.apigateway.IntegrationResponse("chat-options-integration-response", {
    restApi: api.id,
    resourceId: chatResource.id,
    httpMethod: chatOptionsMethod.httpMethod,
    statusCode: "200",
    responseParameters: {
        "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        "method.response.header.Access-Control-Allow-Methods": "'POST,OPTIONS'",
        "method.response.header.Access-Control-Allow-Origin": "'*'",
    },
}, { dependsOn: [chatOptionsIntegration, chatOptionsMethodResponse] });

// Create API Gateway Usage Plan with throttling limits
// Create API Gateway deployment
const deployment = new aws.apigateway.Deployment("api-deployment-v3", {
    restApi: api.id,
    stageName: "prod",
}, { dependsOn: [profileIntegration, chatIntegration, chatOptionsIntegration, chatOptionsIntegrationResponse] });

// Create method-level throttling for chat endpoint
const chatMethodThrottling = new aws.apigateway.MethodSettings("chat-method-throttling", {
    restApi: api.id,
    stageName: "prod",
    methodPath: "*/*", // Apply to all methods
    settings: {
        throttlingRateLimit: 10,
        throttlingBurstLimit: 20,
        metricsEnabled: true,
        loggingLevel: "INFO",
        dataTraceEnabled: true,
    },
}, { dependsOn: [deployment] });

// Create Lambda permission for API Gateway
const lambdaPermission = new aws.lambda.Permission("api-lambda-permission", {
    action: "lambda:InvokeFunction",
    function: lambdaFunction.name,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
});

// Create Chat Lambda permission for API Gateway
const chatLambdaPermission = new aws.lambda.Permission("chat-api-lambda-permission", {
    action: "lambda:InvokeFunction",
    function: chatLambdaFunction.name,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
});

// Note: API Gateway enforces global limits (100/min), Lambda enforces per-IP limits (10/min)
// This provides defense in depth with fast rejection at gateway level
const usagePlan = new aws.apigateway.UsagePlan("chat-usage-plan", {
    name: "chat-usage-plan",
    description: "Usage plan for chat API with rate limiting aligned to Lambda limits",
    throttleSettings: {
        rateLimit: 1.67, // ~1.67 requests per second (100 per minute to match global Lambda limit)
        burstLimit: 10,   // 10 concurrent/burst requests
    },
    quotaSettings: {
        limit: 1000,    // 1000 requests per day as additional safety net
        offset: 0,
        period: "DAY"
    },
    apiStages: [{
        apiId: api.id,
        stage: "prod", // Use the known stage name
    }],
});

// Create API Key for monitoring and potential future per-client limits
const apiKey = new aws.apigateway.ApiKey("chat-api-key", {
    name: "chat-api-key",
    description: "API key for chat service monitoring",
    enabled: true,
});

// Associate API key with usage plan
const usagePlanKey = new aws.apigateway.UsagePlanKey("chat-usage-plan-key", {
    keyId: apiKey.id,
    keyType: "API_KEY",
    usagePlanId: usagePlan.id,
});

// Create API Gateway Custom Domain
const apiCustomDomain = new aws.apigateway.DomainName("api-custom-domain", {
    domainName: apiDomainName,
    certificateArn: certificate.arn,
    endpointConfiguration: {
        types: "EDGE",
    },
}, { dependsOn: [certValidation] });

// Map Custom Domain to API
const apiMapping = new aws.apigateway.BasePathMapping("api-mapping", {
    restApi: api.id,
    stageName: "prod",
    domainName: apiCustomDomain.domainName,
});

// Create Route 53 A records for the website and API
const rootRecord = new aws.route53.Record("root-record", {
    name: domainName,
    type: "A",
    zoneId: hostedZone.then(zone => zone.zoneId),
    aliases: [{
        name: cdn.domainName,
        zoneId: cdn.hostedZoneId,
        evaluateTargetHealth: false,
    }],
});

const wwwRecord = new aws.route53.Record("www-record", {
    name: wwwDomainName,
    type: "A",
    zoneId: hostedZone.then(zone => zone.zoneId),
    aliases: [{
        name: cdn.domainName,
        zoneId: cdn.hostedZoneId,
        evaluateTargetHealth: false,
    }],
});

const apiRecord = new aws.route53.Record("api-record", {
    name: apiDomainName,
    type: "A",
    zoneId: hostedZone.then(zone => zone.zoneId),
    aliases: [{
        name: apiCustomDomain.cloudfrontDomainName,
        zoneId: apiCustomDomain.cloudfrontZoneId,
        evaluateTargetHealth: false,
    }],
});

// Export the website URL, API URL, and DynamoDB table names
export const websiteUrl = cdn.domainName;
export const customWebsiteUrl = `https://${domainName}`;
export const customApiUrl = `https://${apiDomainName}`;
export const apiUrl = deployment.invokeUrl;
export const chatLogsTableName = chatLogsTable.name;
export const rateLimitsTableName = rateLimitsTable.name;
export const apiKeyValue = apiKey.value;