#!/bin/bash

# Deploy infrastructure with Pulumi
echo "Deploying infrastructure with Pulumi..."

cd "$(dirname "$0")/../infrastructure"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "AWS CLI not configured. Please configure AWS credentials."
    exit 1
fi

# Install dependencies
npm install

# Deploy infrastructure
pulumi up --yes

echo "Infrastructure deployment complete!"
echo "Website URL: $(pulumi stack output websiteUrl)"
echo "API URL: $(pulumi stack output apiUrl)"