# About Me Website

A personal website with an AI-powered chat assistant built with Svelte, Amazon Bedrock with Nova Lite and a number of additional AWS services (Route 53, API Gateway, CloudFront, S3, Lambda, CloudWatch, DynamoDB).

Please, try it at [danielnuriyev.info](https://danielnuriyev.info/)

## Prerequisites

### **Node.js 18+**

Install `nvm` (ask your AI how to install it on your OS)

Install the latest node: `nvm install node`

### **Docker Desktop**

Download it from [docker.com](https://www.docker.com/products/docker-desktop/)

### **AWS CLI**

(ask your AI how to install it on your OS)

### **Git**

(ask your AI how to install it on your OS)

## Local Development

### 1. Install Dependencies
```bash
git clone <repository-url>
cd about-me
npm install
```

**Note**: `npm install` installs packages **locally** in the project directory (`node_modules/`) rather than globally. This is the standard and recommended approach for Node.js projects, ensuring each project has its own dependencies and versions.

### 2. Start Local Development Environment
```bash
# Start LocalStack (AWS services locally) - includes CloudWatch Logs
docker-compose up -d
./scripts/localstack-init.sh

# Start development server
npm run dev
```

### 3. Open Browser
Visit `http://localhost:5173` to see your local site.

The chat functionality works in development mode with an intelligent AI assistant that can answer questions about Daniel's professional background, skills, experience, and current projects. The AI uses keyword-based responses trained on Daniel's detailed professional information.

**Note**: For production deployment, the chat API will connect to real AWS services (Amazon Bedrock) in the cloud instead of LocalStack.

### Making Changes

**Frontend**: Edit files in `src/` and changes auto-reload in browser.

**Backend**: Edit Lambda functions in `backend/`, then redeploy:
```bash
./scripts/redeploy-lambda.sh chat
```

**Logs**: View Lambda logs through LocalStack CloudWatch:
```bash
./scripts/view-logs.sh chat                    # View last 50 chat API logs
./scripts/view-logs.sh chat --lines 20         # View last 20 chat API logs
./scripts/view-logs.sh --list                  # List all log groups
```

**Bedrock Mode**: Switch between LocalStack mock and real AWS Bedrock:
```bash
./scripts/setup-bedrock.sh real     # Use real AWS Bedrock (requires AWS credentials)
./scripts/setup-bedrock.sh mock     # Use LocalStack mock (default)
```

**Note**: These commands automatically update the API ID in frontend code and restart LocalStack. Remember to restart your frontend development server (`npm run dev`) after running these commands.

When using real AWS Bedrock, session tokens expire. If you get authentication errors, re-run `./scripts/setup-bedrock.sh real` to refresh credentials.

## Deploy to AWS

### Automated Deployment (Recommended)

1. **Configure GitHub Secrets**:
   - Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to repository secrets

2. **Deploy**:
   ```bash
   git add .
   git commit -m "Deploy to production"
   git push origin main
   ```

### Manual Deployment

```bash
# Deploy everything
./scripts/deploy.sh

# Or step-by-step:
./scripts/deploy-infrastructure.sh
./scripts/deploy-lambda.sh
./scripts/deploy-frontend.sh
```
