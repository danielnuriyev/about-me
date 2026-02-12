import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// Create an S3 bucket for static website hosting
const siteBucket = new aws.s3.Bucket("about-me-site", {
    website: {
        indexDocument: "index.html",
    },
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
    origins: [
        {
            domainName: siteBucket.bucketRegionalDomainName,
            originId: "S3-about-me-site",
            s3OriginConfig: {
                originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath,
            },
        },
    ],
    enabled: true,
    isIpv6Enabled: true,
    defaultCacheBehavior: {
        targetOriginId: "S3-about-me-site",
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
        cloudfrontDefaultCertificate: true,
    },
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

// DynamoDB policy for Lambda
const dynamoPolicy = new aws.iam.Policy("chat-dynamo-policy", {
    policy: chatLogsTable.arn.apply(tableArn => JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Action: [
                    "dynamodb:PutItem",
                    "dynamodb:Query",
                    "dynamodb:Scan"
                ],
                Resource: [
                    tableArn,
                    `${tableArn}/index/*`
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
    reservedConcurrentExecutions: 10, // Limit to 10 concurrent executions
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

// Create API Gateway deployment
const deployment = new aws.apigateway.Deployment("api-deployment", {
    restApi: api.id,
    stageName: "prod",
}, { dependsOn: [profileIntegration, chatIntegration] });

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

// Create API Gateway Usage Plan with throttling limits
const usagePlan = new aws.apigateway.UsagePlan("chat-usage-plan", {
    name: "chat-usage-plan",
    description: "Usage plan for chat API with rate limiting",
    throttleSettings: {
        rateLimit: 3,   // 3 requests per second
        burstLimit: 9,  // 9 burst requests (3x rate limit)
    },
    apiStages: [{
        apiId: api.id,
        stage: deployment.stageName,
    }],
});

// Export the website URL, API URL, and DynamoDB table name
export const websiteUrl = cdn.domainName;
export const apiUrl = deployment.invokeUrl;
export const chatLogsTableName = chatLogsTable.name;