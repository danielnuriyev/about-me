#!/bin/bash

# Quick redeploy script for Lambda functions
# Usage:
#   ./scripts/redeploy-lambda.sh [lambda-name]
#   ./scripts/redeploy-lambda.sh chat  # Redeploy chat Lambda
#   ./scripts/redeploy-lambda.sh       # Interactive selection

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

# Check if LocalStack is running
check_localstack() {
    if ! curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
        error "LocalStack is not running!"
        echo "Start LocalStack first:"
        echo "  docker-compose up -d"
        echo "  ./scripts/localstack-init.sh"
        exit 1
    fi
}

# Redeploy Lambda function
redeploy_lambda() {
    local lambda_name="$1"
    local lambda_dir=""
    local function_name=""
    local zip_file=""
    local env_vars=""

    case "$lambda_name" in
        "chat")
            lambda_dir="$PROJECT_ROOT/backend/lambda-chat"
            function_name="about-me-chat-api"
            zip_file="chat-lambda-function.zip"
            # Include environment variables from .env.local if they exist
            if [ -f "$PROJECT_ROOT/.env.local" ]; then
                local allowed_origins=$(grep "^ALLOWED_ORIGINS=" "$PROJECT_ROOT/.env.local" | cut -d= -f2-)
                if [ -n "$allowed_origins" ]; then
                    env_vars="--environment Variables={ALLOWED_ORIGINS=$allowed_origins}"
                fi
            fi
            ;;
        *)
            error "Unknown Lambda function: $lambda_name"
            echo "Available options: chat, profile"
            exit 1
            ;;
    esac

    log "Redeploying $lambda_name Lambda function..."

    # Check if directory exists
    if [ ! -d "$lambda_dir" ]; then
        error "Lambda directory not found: $lambda_dir"
        exit 1
    fi

    # Navigate to lambda directory
    cd "$lambda_dir"

    # Install dependencies (if package.json exists)
    if [ -f "package.json" ]; then
        log "Installing dependencies..."
        npm install >/dev/null 2>&1
    fi

    # Create zip file
    log "Creating deployment package..."
    rm -f "$zip_file"  # Remove old zip if exists
    zip -r "$zip_file" . >/dev/null 2>&1

    # Check if zip was created successfully
    if [ ! -f "$zip_file" ]; then
        error "Failed to create zip file: $zip_file"
        exit 1
    fi

    # Update Lambda function
    log "Updating Lambda function: $function_name"
    local aws_cmd="aws lambda update-function-code \
        --function-name \"$function_name\" \
        --zip-file \"fileb://$zip_file\" \
        --endpoint-url=http://localhost:4566"

    if [ -n "$env_vars" ]; then
        log "Updating function configuration with environment variables..."
        eval "aws lambda update-function-configuration \
            --function-name \"$function_name\" \
            $env_vars \
            --endpoint-url=http://localhost:4566 >/dev/null 2>&1" || warning "Failed to update environment variables"
    fi

    if eval "$aws_cmd >/dev/null 2>&1"; then
        success "Successfully redeployed $lambda_name Lambda function!"
        echo "Function: $function_name"
        echo "Package: $zip_file ($(du -h "$zip_file" | cut -f1))"
        if [ -n "$env_vars" ]; then
            echo "Environment: Updated"
        fi
    else
        error "Failed to update Lambda function: $function_name"
        exit 1
    fi

    # Clean up zip file
    rm -f "$zip_file"
    log "Cleaned up temporary files"
}

# Interactive selection
select_lambda() {
    echo "Which Lambda function would you like to redeploy?"
    echo "1) chat - Chat API with Bedrock integration"
    echo ""

    while true; do
        read -p "Enter choice (1): " choice
        case $choice in
            1)
                redeploy_lambda "chat"
                break
                ;;
            *)
                warning "Please enter 1"
                ;;
        esac
    done
}

# Main execution
main() {
    check_localstack

    if [ $# -eq 0 ]; then
        # No arguments - show interactive menu
        select_lambda
    else
        # Argument provided - use it directly
        redeploy_lambda "$1"
    fi

    echo ""
    success "Redeploy complete!"
    echo "Test your changes:"
    echo "  curl -X POST http://localhost:4566/restapis/YOUR_API_ID/prod/_user_request_/chat \\"
    echo "    -H 'Content-Type: application/json' -H 'Origin: http://localhost:5174' \\"
    echo "    -d '{\"message\": \"hi\"}'"
}

# Show usage if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Lambda Redeploy Script"
    echo ""
    echo "Usage:"
    echo "  $0 [lambda-name]    # Redeploy specific Lambda"
    echo "  $0                   # Interactive selection"
    echo ""
    echo "Lambda functions:"
    echo "  chat                 # Chat API with Bedrock"
    echo ""
    echo "Examples:"
    echo "  $0 chat             # Redeploy chat Lambda"
    echo "  $0                  # Show interactive menu"
    exit 0
fi

# Run main function
main "$@"