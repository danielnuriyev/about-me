# About Me Website

A single-page website about Daniel Nuriyev built with Svelte, featuring an AI-powered chat assistant using AWS Bedrock. Deployed on AWS using S3, CloudFront, API Gateway, and Lambda with full local development support via LocalStack.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Local Development Setup](#local-development-setup)
- [Testing](#testing)
- [Deployment to AWS](#deployment-to-aws)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Features

- **GitHub Dark Theme**: Authentic GitHub dark theme with proper colors and styling
- **Personal Profile**: Clean, responsive design showcasing personal information with GitHub profile photo
- **Social Links**: Direct links to LinkedIn, GitHub, and engineering blog
- **AI Spokesbot**: Interactive chat assistant powered by AWS Bedrock using Amazon Nova Micro with security protections
- **Conversation Logging**: All chat interactions stored in DynamoDB for monitoring and analytics
- **Serverless Backend**: Two Lambda functions handling profile data and chat interactions
- **Security Protections**: Rate limiting, origin validation, and content filtering
- **Global CDN**: CloudFront distribution for fast content delivery
- **Local Development**: Complete LocalStack setup for offline development with real AWS Bedrock testing option

## Architecture

- **Frontend**: Svelte with JavaScript
- **Backend**: AWS Lambda + API Gateway
- **AI Chat**: AWS Bedrock integration (Amazon Nova Micro)
- **Hosting**: S3 + CloudFront
- **Infrastructure**: Pulumi (Infrastructure as Code)
- **Local Development**: LocalStack with Docker
- **Deployment**: GitHub Actions CI/CD

## Prerequisites

- **Node.js 18+** - Required for Svelte development
- **Docker & Docker Compose** - Required for LocalStack local development
- **AWS CLI** - Optional but recommended for AWS operations
- **Git** - For cloning the repository

## Quick Start

### 1. Download and Install

```bash
# Clone the repository
git clone <repository-url>
cd about-me

# Install dependencies
npm install
```

### 2. Start Local Development

```bash
# Start LocalStack (AWS services locally)
docker-compose up -d
./localstack-init.sh

# Start the development server
npm run dev
```

### 3. Open in Browser

Visit `http://localhost:5173` to see your local development site.

## Local Development Setup

### Basic Setup (LocalStack Mock)

1. **Start LocalStack services**:
   ```bash
   docker-compose up -d
   ./localstack-init.sh
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

### Advanced Setup (Real AWS Bedrock)

For testing with real AWS Bedrock instead of LocalStack mocks:

1. **Configure AWS credentials**:
   ```bash
   aws configure
   # Or set environment variables:
   # export AWS_ACCESS_KEY_ID=your_key
   # export AWS_SECRET_ACCESS_KEY=your_secret
   ```

2. **Switch to real Bedrock mode**:
   ```bash
   ./setup-bedrock.sh real
   ```

3. **Start development**:
   ```bash
   npm run dev
   ```

**Note**: Real AWS Bedrock requires:
- AWS account with Bedrock access enabled
- Access to Amazon Nova Micro model (may require explicit request in AWS console)
- IAM permissions for `bedrock:InvokeModel`
- Corporate accounts may have additional AI service restrictions

### Project Structure

```
about-me/
├── src/
│   ├── lib/Chat.svelte     # Chat component
│   └── routes/+page.svelte # Main about me page
├── backend/
│   ├── lambda/             # Profile API Lambda
│   └── lambda-chat/        # Chat API Lambda with Bedrock integration
├── infrastructure/         # Pulumi IaC (S3, CloudFront, API Gateway, Lambda, DynamoDB)
├── scripts/               # Deployment scripts
│   ├── deploy.sh          # Complete deployment
│   ├── deploy-infrastructure.sh
│   ├── deploy-lambda.sh
│   └── deploy-frontend.sh
├── static/                # Static assets (images, etc.)
├── .github/workflows/     # CI/CD pipelines
├── docker-compose.yml     # LocalStack configuration
├── setup-bedrock.sh      # Bedrock mode switcher
└── localstack-init.sh    # LocalStack resource initialization
```

## Testing

### Local Testing

#### Test Profile API
```bash
# Get API Gateway ID first
curl -s http://localhost:4566/restapis | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4

# Test profile endpoint (replace YOUR_API_ID)
curl http://localhost:4566/restapis/YOUR_API_ID/prod/_user_request_/profile
```

#### Test Chat API
```bash
# Test chat endpoint
curl -X POST http://localhost:4566/restapis/YOUR_API_ID/prod/_user_request_/chat \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"message": "Hello, tell me about Daniel"}'
```

### Frontend Testing

```bash
# Start development server
npm run dev

# Open http://localhost:5173 in browser
# Test the chat interface and profile display
```

### Code Quality Testing

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking (if using TypeScript)
npm run check
```

## Deployment to AWS

### Option 1: Automated Deployment (Recommended)

#### CI/CD via GitHub Actions

1. **Configure GitHub Secrets**:
   - Go to your repository Settings → Secrets and variables → Actions
   - Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

2. **Deploy**:
   ```bash
   # Push to main branch to trigger automatic deployment
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

#### Manual Automated Deployment

```bash
# Deploy everything at once
./scripts/deploy.sh
```

### Option 2: Manual Step-by-Step Deployment

1. **Deploy Infrastructure**:
   ```bash
   ./scripts/deploy-infrastructure.sh
   ```

2. **Deploy Lambda Functions**:
   ```bash
   ./scripts/deploy-lambda.sh
   ```

3. **Deploy Frontend**:
   ```bash
   ./scripts/deploy-frontend.sh
   ```

### Post-Deployment Configuration

1. **Update Domain DNS**:
   - Point your domain to the CloudFront distribution URL
   - The script will output the CloudFront URL

2. **Configure Environment Variables**:
   ```bash
   # Set production environment variables
   export ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   export CHAT_LOGS_TABLE=chat-conversations
   ```

3. **Update Content**:
   - Replace placeholder photo in `static/`
   - Update personal information in `backend/lambda/index.js`
   - Customize styling in `src/routes/+page.svelte`

### Verify Deployment

```bash
# Check website is live
curl https://yourdomain.com

# Test API endpoints
curl https://your-api-gateway-url/prod/_user_request_/profile
```

## Configuration

### Environment Variables

#### Production Environment Variables
```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CHAT_LOGS_TABLE=chat-conversations
```

#### Local Development Variables
```bash
USE_REAL_BEDROCK=true  # Enable real AWS Bedrock (requires AWS credentials)
AWS_PROFILE=default    # AWS CLI profile to use
```

### Customization

1. **Personal Information**: Edit `backend/lambda/index.js`
2. **Profile Photo**: Replace `static/placeholder.jpg` and update `src/routes/+page.svelte`
3. **Styling**: Modify CSS in `src/routes/+page.svelte`
4. **AI Context**: Update `DANIEL_CONTEXT` in `backend/lambda-chat/index.js`

### Security Features

#### Chat API Protection
- **Origin Validation**: Only allowed domains accepted
- **Rate Limiting**: 50 requests/hour, 200 requests/day per IP
- **Content Filtering**: Blocks malicious scripts and content
- **Request Limits**: 1000 chars/message, 20 messages in context
- **CORS Restrictions**: Strict cross-origin policies

#### Conversation Logging
- **DynamoDB Storage**: All conversations with metadata
- **Monitoring**: Track usage patterns and anomalies
- **Compliance**: Audit trail for all interactions

## Troubleshooting

### Common Issues

#### LocalStack Won't Start
```bash
# Check Docker is running
docker --version
docker-compose --version

# Clean restart
docker-compose down
docker system prune -f
docker-compose up -d
```

#### Bedrock Authentication Errors
- Corporate AWS accounts may restrict Bedrock access
- Request model access in AWS Bedrock console
- Check IAM permissions include `bedrock:InvokeModel`

#### Port Conflicts
```bash
# Check what's using port 4566
lsof -i :4566

# Change LocalStack port in docker-compose.yml if needed
```

#### Build Errors
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build cache
npm run build -- --emptyOutDir
```

### LocalStack Services

- **Lambda**: Serverless function execution
- **API Gateway**: REST API management
- **S3**: File storage and static hosting
- **DynamoDB**: NoSQL database for chat logs
- **IAM**: Identity and access management
- **Bedrock**: AI model integration (mock or real)

### Getting Help

1. Check LocalStack logs: `docker logs localstack_main`
2. Verify AWS credentials: `aws sts get-caller-identity`
3. Test individual services using AWS CLI with `--endpoint-url=http://localhost:4566`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with LocalStack
5. Submit a pull request

## License

ISC License - see LICENSE file for details.