# LocalStack Setup

This project uses LocalStack to simulate AWS services locally for development and testing.

## Prerequisites

- Docker and Docker Compose
- AWS CLI (optional, for manual testing)

## Starting LocalStack

1. Start LocalStack:
```bash
docker-compose up -d
```

2. Initialize AWS resources:
```bash
./localstack-init.sh
```

## Testing the API

Once LocalStack is running, you can test the API:

```bash
curl http://localhost:4566/restapis/YOUR_API_ID/prod/_user_request_/profile
```

Replace `YOUR_API_ID` with the actual API ID shown in the initialization output.

## Stopping LocalStack

```bash
docker-compose down
```

## Services Configured

- **Lambda**: about-me-api function
- **API Gateway**: REST API with /profile endpoint
- **S3**: about-me-site bucket (for static hosting)
- **IAM**: Basic roles for Lambda execution