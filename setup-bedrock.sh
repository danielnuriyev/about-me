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

./localstack-init.sh

echo ""
echo "✅ Setup complete!"
if [ "$USE_REAL_BEDROCK" = "true" ]; then
    echo "🤖 Using REAL AWS Bedrock - AI responses will be from actual Nova model"
else
    echo "🎭 Using LocalStack mock - AI responses will be simulated"
fi