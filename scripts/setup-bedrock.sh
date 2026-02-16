#!/bin/bash

# Helper script to easily switch between LocalStack mock and real AWS Bedrock
# Usage:
#   ./setup-bedrock.sh mock     - Use LocalStack Bedrock mock (default)
#   ./setup-bedrock.sh real     - Use real AWS Bedrock (requires AWS credentials)

set -e

if [ "$1" = "real" ]; then
    echo "🔄 Switching to REAL AWS Bedrock mode..."

    # Check if AWS credentials are available (in ~/.aws/credentials or environment)
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo "❌ Error: AWS credentials not found!"
        echo ""
        echo "Please configure your AWS credentials:"
        echo "1. Run: aws configure"
        echo "2. Or set environment variables:"
        echo "   export AWS_ACCESS_KEY_ID=your_access_key"
        echo "   export AWS_SECRET_ACCESS_KEY=your_secret_key"
        echo "   export AWS_DEFAULT_REGION=us-east-1"
        echo ""
        echo "Note: Credentials will be loaded from ~/.aws/credentials by default"
        exit 1
    fi

    export USE_REAL_BEDROCK=true
    echo "✅ Real AWS Bedrock mode enabled"
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo 'unknown')
    echo "🔑 Using AWS account: $AWS_ACCOUNT"

elif [ "$1" = "mock" ] || [ -z "$1" ]; then
    echo "🔄 Switching to LocalStack Bedrock mock mode..."
    unset USE_REAL_BEDROCK
    echo "✅ LocalStack mock mode enabled"

else
    echo "❌ Usage: $0 [mock|real]"
    echo "  mock - Use LocalStack Bedrock mock (default)"
    echo "  real - Use real AWS Bedrock (requires AWS credentials)"
    exit 1
fi

echo ""
echo "🔄 Re-initializing LocalStack..."
docker-compose down 2>/dev/null || true
docker-compose up -d

echo "⏳ Waiting for LocalStack to be ready..."
sleep 5

./scripts/localstack-init.sh

# Update the API ID in hooks.server.js
update_frontend_api_id() {
    local hooks_file="./src/hooks.server.js"
    if [ ! -f "$hooks_file" ]; then
        echo "⚠️  hooks.server.js not found, skipping API ID update"
        return
    fi

    # Get the new API ID from LocalStack
    local new_api_id
    new_api_id=$(aws apigateway get-rest-apis --endpoint-url=http://localhost:4566 | jq -r '.items[0].id' 2>/dev/null)

    if [ -z "$new_api_id" ] || [ "$new_api_id" = "null" ]; then
        echo "⚠️  Could not retrieve API ID from LocalStack, skipping API ID update"
        return
    fi

    # Extract current hardcoded API ID from the file
    local old_api_id
    old_api_id=$(grep "restapis/" "$hooks_file" | sed 's/.*restapis\/\([^/]*\).*/\1/' | head -1)

    if [ -n "$old_api_id" ] && [ "$old_api_id" != "$new_api_id" ]; then
        echo "🔄 Updating API ID from $old_api_id to $new_api_id in hooks.server.js"
        sed -i.bak "s/restapis\/$old_api_id/restapis\/$new_api_id/g" "$hooks_file"
        echo "✅ Updated API ID in hooks.server.js"
    else
        echo "✅ API ID is already up to date or not found in hooks.server.js"
    fi
}

echo ""
echo "🔄 Updating API ID in frontend code..."
update_frontend_api_id

echo ""
echo "✅ Setup complete!"
if [ "$USE_REAL_BEDROCK" = "true" ]; then
    echo "🤖 Using REAL AWS Bedrock - AI responses will be from actual Nova model"
else
    echo "🎭 Using LocalStack mock - AI responses will be simulated"
fi

echo ""
echo "💡 Remember to restart your frontend development server if it's running:"
echo "   npm run dev"