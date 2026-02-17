#!/bin/bash

# Deploy Lambda functions
echo "Deploying Lambda functions..."

# Check if we're in the scripts directory
if [ ! -f "deploy.sh" ] || [ ! -d "../backend" ]; then
    echo "Error: This script must be run from the scripts/ directory"
    echo "Usage: cd scripts && ./deploy-lambda.sh"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "AWS CLI not configured. Please configure AWS credentials."
    exit 1
fi

# Skip main Lambda function deployment (removed)

# Deploy chat Lambda function
echo "Deploying chat Lambda function..."
cd "../backend/lambda-chat"

# Install dependencies
if [ -f "package.json" ]; then
    echo "Installing npm dependencies..."
    if ! npm install --production; then
        echo "Error: Failed to install npm dependencies"
        exit 1
    fi
fi

# Create deployment package
echo "Creating chat Lambda deployment package..."
if ! zip -r chat-lambda-function.zip . -x "*.git*" "*node_modules/.bin*" "*.DS_Store"; then
    echo "Error: Failed to create deployment package"
    exit 1
fi

# Get chat Lambda function name and table names from Pulumi
echo "Retrieving infrastructure configuration from Pulumi..."
CHAT_FUNCTION_NAME=$(cd ../../infrastructure && pulumi stack output chatLambdaFunctionName 2>/dev/null || echo "about-me-chat-api-4aa0dbe")
CHAT_TABLE_NAME=$(cd ../../infrastructure && pulumi stack output chatLogsTableName 2>/dev/null || echo "chat-conversations-e129484")
RATE_LIMIT_TABLE_NAME=$(cd ../../infrastructure && pulumi stack output rateLimitsTableName 2>/dev/null || echo "rate-limits-c7b3042")

echo "Using Lambda function: $CHAT_FUNCTION_NAME"
echo "Using chat table: $CHAT_TABLE_NAME"
echo "Using rate limit table: $RATE_LIMIT_TABLE_NAME"

# Update chat Lambda function
echo "Updating chat Lambda function: $CHAT_FUNCTION_NAME"
if ! aws lambda update-function-code \
    --function-name $CHAT_FUNCTION_NAME \
    --zip-file fileb://chat-lambda-function.zip; then
    echo "Error: Failed to update Lambda function code"
    rm -f chat-lambda-function.zip
    exit 1
fi

# Wait for function update to complete
echo "Waiting for Lambda function update to complete..."
if ! aws lambda wait function-updated --function-name $CHAT_FUNCTION_NAME; then
    echo "Error: Lambda function update did not complete successfully"
    rm -f chat-lambda-function.zip
    exit 1
fi

# Update environment variables
echo "Updating environment variables for chat Lambda..."
if ! aws lambda update-function-configuration \
    --function-name $CHAT_FUNCTION_NAME \
    --environment "Variables={CHAT_LOGS_TABLE=$CHAT_TABLE_NAME,RATE_LIMIT_TABLE=$RATE_LIMIT_TABLE_NAME,USE_REAL_BEDROCK=true}"; then
    echo "Error: Failed to update Lambda function environment variables"
    exit 1
fi

# Clean up
rm chat-lambda-function.zip

echo "Lambda deployment complete!"