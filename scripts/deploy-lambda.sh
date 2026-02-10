#!/bin/bash

# Deploy Lambda functions
echo "Deploying Lambda functions..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "AWS CLI not configured. Please configure AWS credentials."
    exit 1
fi

# Deploy main Lambda function
echo "Deploying main Lambda function..."
cd "$(dirname "$0")/../backend/lambda"

# Install dependencies if any
if [ -f "package.json" ]; then
    npm install --production
fi

# Create deployment package
echo "Creating main Lambda deployment package..."
zip -r lambda-function.zip . -x "*.git*" "*node_modules/.bin*" "*.DS_Store"

# Get Lambda function name from Pulumi
FUNCTION_NAME=$(cd ../../infrastructure && pulumi stack output lambdaFunctionName 2>/dev/null || echo "about-me-api")

# Update Lambda function
echo "Updating Lambda function: $FUNCTION_NAME"
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://lambda-function.zip

# Clean up
rm lambda-function.zip

# Deploy chat Lambda function
echo "Deploying chat Lambda function..."
cd "../lambda-chat"

# Install dependencies
if [ -f "package.json" ]; then
    npm install --production
fi

# Create deployment package
echo "Creating chat Lambda deployment package..."
zip -r chat-lambda-function.zip . -x "*.git*" "*node_modules/.bin*" "*.DS_Store"

# Get chat Lambda function name and table name from Pulumi
CHAT_FUNCTION_NAME=$(cd ../../infrastructure && pulumi stack output chatLambdaFunctionName 2>/dev/null || echo "about-me-chat-api")
CHAT_TABLE_NAME=$(cd ../../infrastructure && pulumi stack output chatLogsTableName 2>/dev/null || echo "chat-conversations")

# Update chat Lambda function
echo "Updating chat Lambda function: $CHAT_FUNCTION_NAME"
aws lambda update-function-code \
    --function-name $CHAT_FUNCTION_NAME \
    --zip-file fileb://chat-lambda-function.zip

# Update environment variables
echo "Updating environment variables for chat Lambda..."
aws lambda update-function-configuration \
    --function-name $CHAT_FUNCTION_NAME \
    --environment "Variables={CHAT_LOGS_TABLE=$CHAT_TABLE_NAME}"

# Clean up
rm chat-lambda-function.zip

echo "Lambda deployment complete!"