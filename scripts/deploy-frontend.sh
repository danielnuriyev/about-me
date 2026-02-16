#!/bin/bash

# Deploy frontend to S3
echo "Deploying frontend to S3..."

cd "$(dirname "$0")/.."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "AWS CLI not configured. Please configure AWS credentials."
    exit 1
fi

# Get the S3 bucket name from Pulumi outputs
BUCKET_NAME=$(cd infrastructure && pulumi stack output bucketName 2>/dev/null || echo "dn-about-me-95400e2")

# Build the frontend first
echo "Building Svelte frontend..."
npm install
npm run build
echo "Frontend build complete. Output in build/ directory."

# Sync build directory to S3
echo "Uploading to S3 bucket: $BUCKET_NAME"
aws s3 sync build/ s3://$BUCKET_NAME --delete --cache-control max-age=31536000,public

# Set cache control for HTML files
aws s3 cp s3://$BUCKET_NAME/index.html s3://$BUCKET_NAME/index.html --metadata-directive REPLACE --cache-control max-age=0,no-cache,no-store,must-revalidate --content-type text/html

echo "Frontend deployment complete!"
echo "Website URL: $(cd infrastructure && pulumi stack output websiteUrl 2>/dev/null || echo "Check Pulumi outputs")"