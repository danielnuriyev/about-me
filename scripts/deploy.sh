#!/bin/bash

# Complete deployment script
echo "Starting complete deployment..."

# Make all scripts executable
chmod +x scripts/*.sh

# Deploy infrastructure first
echo "Step 1: Deploying infrastructure..."
./scripts/deploy-infrastructure.sh

# Deploy Lambda function
echo "Step 2: Deploying Lambda function..."
./scripts/deploy-lambda.sh

# Deploy frontend
echo "Step 3: Deploying frontend..."
./scripts/deploy-frontend.sh

echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Update your domain DNS to point to the CloudFront distribution"
echo "2. Replace the placeholder image with your actual photo"
echo "3. Update the Lambda function with your real information"