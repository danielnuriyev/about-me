#!/bin/bash

# Configure concurrency and rate limiting for production deployment
# Usage:
#   ./scripts/configure-limits.sh lambda [concurrency]  # Set Lambda concurrency
#   ./scripts/configure-limits.sh apigateway [rate] [burst]  # Set API Gateway throttling

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

configure_lambda_concurrency() {
    local concurrency="$1"

    if [ -z "$concurrency" ]; then
        concurrency=10  # Default to 10 if not specified
    fi

    log "Setting Lambda concurrency to $concurrency..."

    # Check if AWS credentials are available
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS credentials not configured"
        exit 1
    fi

    # Set Lambda concurrency
    aws lambda put-function-concurrency \
        --function-name about-me-chat-api \
        --reserved-concurrent-executions "$concurrency" 2>/dev/null

    if [ $? -eq 0 ]; then
        success "Lambda concurrency set to $concurrency"
        echo "This limits concurrent executions to prevent resource exhaustion"
        echo "Note: Infrastructure code sets this to 10 by default"
    else
        error "Failed to set Lambda concurrency"
        echo "Make sure the function is deployed and you have proper permissions"
    fi
}

configure_apigateway_throttling() {
    local rate="$1"
    local burst="$2"

    # Set defaults if not provided
    rate="${rate:-3}"    # Default 3 requests per second
    burst="${burst:-9}"  # Default 9 burst (3x rate)

    log "Configuring API Gateway throttling (Rate: ${rate}/s, Burst: ${burst}/s)..."

    # Check if API Gateway exists
    local api_id
    api_id=$(aws apigateway get-rest-apis --query 'items[?name==`about-me-api`].id' --output text 2>/dev/null)

    if [ -z "$api_id" ] || [ "$api_id" = "None" ]; then
        warning "API Gateway 'about-me-api' not found"
        echo "Make sure the infrastructure is deployed first with: ./scripts/deploy-infrastructure.sh"
        echo ""
        echo "Manual configuration after deployment:"
        echo ""
        echo "# Create usage plan:"
        echo "aws apigateway create-usage-plan \\"
        echo "  --name chat-usage-plan \\"
        echo "  --throttle-rate-limit $rate \\"
        echo "  --throttle-burst-limit $burst \\"
        echo "  --api-stages apiId=YOUR_API_ID,stage=prod"
        echo ""
        return 1
    fi

    # Check if usage plan already exists
    local plan_id
    plan_id=$(aws apigateway get-usage-plans --query 'items[?name==`chat-usage-plan`].id' --output text 2>/dev/null)

    if [ -n "$plan_id" ] && [ "$plan_id" != "None" ]; then
        log "Updating existing usage plan..."
        aws apigateway update-usage-plan \
            --usage-plan-id "$plan_id" \
            --patch-op replace \
            --path '/throttle/rateLimit' \
            --value "$rate" >/dev/null 2>&1

        aws apigateway update-usage-plan \
            --usage-plan-id "$plan_id" \
            --patch-op replace \
            --path '/throttle/burstLimit' \
            --value "$burst" >/dev/null 2>&1

        success "Updated API Gateway throttling (Rate: ${rate}/s, Burst: ${burst}/s)"
    else
        log "Creating new usage plan..."
        aws apigateway create-usage-plan \
            --name chat-usage-plan \
            --throttle-rate-limit "$rate" \
            --throttle-burst-limit "$burst" \
            --api-stages "apiId=$api_id,stage=prod" >/dev/null 2>&1

        success "Created API Gateway throttling (Rate: ${rate}/s, Burst: ${burst}/s)"
    fi

    echo "API Gateway limits protect against excessive traffic and ensure fair usage"
}

show_current_limits() {
    log "Checking current limits..."

    echo ""
    echo "=== Current Lambda Concurrency ==="
    aws lambda get-function-concurrency \
        --function-name about-me-chat-api 2>/dev/null || echo "Not configured or function not found"

    echo ""
    echo "=== Current API Gateway Limits ==="
    echo "Rate limiting is implemented in Lambda function code:"
    echo "- 10 requests per hour per IP address"
    echo "- No daily limit (removed for simplicity)"
    echo ""
    warning "For production, configure API Gateway throttling as shown above"
}

show_help() {
    echo "Configure Concurrency and Rate Limiting"
    echo ""
    echo "Usage:"
    echo "  $0 lambda <concurrency>     # Set Lambda reserved concurrency"
    echo "  $0 apigateway <rate> <burst> # Configure API Gateway throttling"
    echo "  $0 status                   # Show current limits"
    echo "  $0 help                     # Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 lambda 5                 # Limit Lambda to 5 concurrent executions"
    echo "  $0 apigateway 10 20         # 10 requests/sec, 20 burst"
    echo "  $0 status                   # Check current configuration"
    echo ""
    echo "Note: Requires AWS credentials and deployed resources"
}

# Main execution
case "${1:-help}" in
    lambda)
        configure_lambda_concurrency "$2"
        ;;
    apigateway)
        configure_apigateway_throttling "$2" "$3"
        ;;
    status)
        show_current_limits
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac