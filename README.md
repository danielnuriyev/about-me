# About Me Website

A personal website with an AI-powered chat assistant built with Svelte, AWS Lambda, and Amazon Bedrock.

## Prerequisites

- **Node.js 18+**
- **Docker & Docker Compose** (for local development)
- **AWS CLI** (optional, for AWS operations)
- **Git**

## Local Development

### 1. Install Dependencies
```bash
git clone <repository-url>
cd about-me
npm install
```

### 2. Start Local Development Environment
```bash
# Start LocalStack (AWS services locally)
docker-compose up -d
./scripts/localstack-init.sh

# Start development server
npm run dev
```

### 3. Open Browser
Visit `http://localhost:5173` to see your local site.

### Making Changes

**Frontend**: Edit files in `src/` and changes auto-reload in browser.

**Backend**: Edit Lambda functions in `backend/`, then redeploy:
```bash
./scripts/redeploy-lambda.sh chat
```

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
