# About Me Website

A single-page website about Daniel Nuriyev built with Svelte, featuring an AI-powered chat assistant using AWS Bedrock. Deployed on AWS using S3, CloudFront, API Gateway, and Lambda.

## Architecture

- **Frontend**: Svelte with JavaScript
- **Backend**: AWS Lambda + API Gateway
- **AI Chat**: AWS Bedrock integration
- **Hosting**: S3 + CloudFront
- **Infrastructure**: Pulumi (Infrastructure as Code)
- **Local Development**: LocalStack
- **Deployment**: GitHub Actions CI/CD

## Features

- **GitHub Dark Theme**: Authentic GitHub dark theme with proper colors and styling
- **Personal Profile**: Clean, responsive design showcasing personal information with GitHub profile photo
- **Social Links**: Direct links to LinkedIn, GitHub, and engineering blog
- **AI Chat Assistant**: Interactive chat powered by AWS Bedrock using Amazon Nova Micro with security protections
- **Conversation Logging**: All chat interactions stored in DynamoDB for monitoring and analytics
- **Serverless Backend**: Two Lambda functions handling profile data and chat interactions
- **Security Protections**: Rate limiting, origin validation, and content filtering
- **Global CDN**: CloudFront distribution for fast content delivery
- **Local Development**: Complete LocalStack setup for offline development

## Security Features

### Chat API Protection
- **Origin Validation**: Only requests from allowed domains are accepted
- **Rate Limiting**: 50 requests/hour, 200 requests/day per IP address
- **Content Filtering**: Blocks potentially malicious content and scripts
- **Request Size Limits**: Maximum 1000 characters per message, 20 messages in context
- **CORS Restrictions**: Strict cross-origin resource sharing policies

### Conversation Logging
- **DynamoDB Storage**: All conversations stored with metadata (IP, timestamp, user agent)
- **Structured Data**: Messages, responses, processing time, and status tracked
- **Query Capabilities**: Search by conversation ID, IP address, or timestamp
- **Monitoring**: Track usage patterns and detect anomalies
- **Compliance**: Maintain conversation history for auditing purposes

### Environment Variables
Set the following environment variables for production:

```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CHAT_LOGS_TABLE=chat-conversations
```

## Project Structure

```
about-me/
├── src/
│   ├── lib/Chat.svelte     # Chat component
│   └── routes/+page.svelte # Main about me page
├── backend/
│   ├── lambda/             # Profile API Lambda
│   └── lambda-chat/        # Chat API Lambda
├── infrastructure/         # Pulumi IaC
├── scripts/               # Deployment scripts
├── static/                # Static assets
├── .github/workflows/     # CI/CD pipelines
└── docker-compose.yml     # LocalStack configuration
```

## Local Development

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for LocalStack)
- AWS CLI (configured)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start LocalStack**:
   ```bash
   docker-compose up -d
   ./localstack-init.sh
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Test the API locally**:
   ```bash
   curl http://localhost:4566/restapis/YOUR_API_ID/prod/_user_request_/profile
   ```

## Deployment

### Manual Deployment

1. **Deploy infrastructure**:
   ```bash
   ./scripts/deploy-infrastructure.sh
   ```

2. **Deploy Lambda function**:
   ```bash
   ./scripts/deploy-lambda.sh
   ```

3. **Deploy frontend**:
   ```bash
   ./scripts/deploy-frontend.sh
   ```

### Or deploy everything at once:

```bash
./scripts/deploy.sh
```

### CI/CD Deployment

The project includes GitHub Actions for automated deployment. Push to the `main` branch to trigger deployment.

**Required GitHub Secrets**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier

## Customization

1. **Update your information**: Edit `backend/lambda/index.js` with your details
2. **Replace the placeholder photo**: Add your photo to `static/` and update `src/routes/+page.svelte`
3. **Customize styling**: Modify the CSS in `src/routes/+page.svelte`

## AWS Services Used

- **S3**: Static website hosting
- **CloudFront**: CDN and HTTPS
- **Lambda**: Serverless backend API
- **API Gateway**: REST API management
- **IAM**: Access management

## LocalStack

For local development, LocalStack simulates AWS services. See `README-LOCALSTACK.md` for detailed setup instructions.