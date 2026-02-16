#!/bin/bash

# Deploy Lambda functions
echo "Deploying Lambda functions..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "AWS CLI not configured. Please configure AWS credentials."
    exit 1
fi

# Skip main Lambda function deployment (removed)

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

# Get chat Lambda function name and table names from Pulumi
CHAT_FUNCTION_NAME=$(cd ../../infrastructure && pulumi stack output chatLambdaFunctionName 2>/dev/null || echo "about-me-chat-api-4aa0dbe")
CHAT_TABLE_NAME=$(cd ../../infrastructure && pulumi stack output chatLogsTableName 2>/dev/null || echo "chat-conversations-e129484")
RATE_LIMIT_TABLE_NAME=$(cd ../../infrastructure && pulumi stack output rateLimitsTableName 2>/dev/null || echo "rate-limits-c7b3042")

# Update chat Lambda function
echo "Updating chat Lambda function: $CHAT_FUNCTION_NAME"
aws lambda update-function-code \
    --function-name $CHAT_FUNCTION_NAME \
    --zip-file fileb://chat-lambda-function.zip

# Wait for function update to complete
echo "Waiting for Lambda function update to complete..."
aws lambda wait function-updated --function-name $CHAT_FUNCTION_NAME

# Update environment variables
echo "Updating environment variables for chat Lambda..."
aws lambda update-function-configuration \
    --function-name $CHAT_FUNCTION_NAME \
    --environment "Variables={CHAT_LOGS_TABLE=$CHAT_TABLE_NAME,RATE_LIMIT_TABLE=$RATE_LIMIT_TABLE_NAME,USE_REAL_BEDROCK=true}"

# Clean up
rm chat-lambda-function.zip

echo "Lambda deployment complete!"