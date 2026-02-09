#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
while ! curl -s http://localhost:4566/_localstack/health | grep -q '"apigateway":"available"'; do
  sleep 2
done

echo "LocalStack is ready. Setting up resources..."

# Set AWS CLI to use LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566

# Create S3 bucket
echo "Creating S3 bucket..."
aws s3 mb s3://about-me-site --endpoint-url=http://localhost:4566

# Create Lambda function
echo "Creating Lambda function..."
cd backend/lambda
zip -r lambda-function.zip .

aws lambda create-function \
  --function-name about-me-api \
  --runtime nodejs18.x \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --handler index.handler \
  --zip-file fileb://lambda-function.zip \
  --endpoint-url=http://localhost:4566

# Create Chat Lambda function
echo "Creating Chat Lambda function..."
cd ../lambda-chat
npm install
zip -r chat-lambda-function.zip .

aws lambda create-function \
  --function-name about-me-chat-api \
  --runtime nodejs18.x \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --handler index.handler \
  --zip-file fileb://chat-lambda-function.zip \
  --timeout 30 \
  --endpoint-url=http://localhost:4566

# Create API Gateway
echo "Creating API Gateway..."
aws apigateway create-rest-api \
  --name about-me-api \
  --endpoint-url=http://localhost:4566

# Get API ID
API_ID=$(aws apigateway get-rest-apis --endpoint-url=http://localhost:4566 | jq -r '.items[0].id')

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --endpoint-url=http://localhost:4566 | jq -r '.items[0].id')

# Create profile resource
PROFILE_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part profile \
  --endpoint-url=http://localhost:4566 | jq -r '.id')

# Create profile method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $PROFILE_RESOURCE_ID \
  --http-method GET \
  --authorization-type NONE \
  --endpoint-url=http://localhost:4566

# Create profile integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $PROFILE_RESOURCE_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:about-me-api/invocations \
  --endpoint-url=http://localhost:4566

# Create chat resource
CHAT_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part chat \
  --endpoint-url=http://localhost:4566 | jq -r '.id')

# Create chat method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $CHAT_RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE \
  --endpoint-url=http://localhost:4566

# Create chat integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $CHAT_RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:about-me-chat-api/invocations \
  --endpoint-url=http://localhost:4566

# Create deployment
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --endpoint-url=http://localhost:4566

echo "LocalStack setup complete!"
echo "API Gateway URL: http://localhost:4566/restapis/$API_ID/prod/_user_request_/profile"