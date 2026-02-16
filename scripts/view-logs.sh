#!/bin/bash

# View Lambda logs from LocalStack CloudWatch Logs
# Usage: ./scripts/view-logs.sh [function-name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
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

# Get the latest log stream for a function
get_latest_log_stream() {
    local function_name="$1"
    local log_group="/aws/lambda/${function_name}"

    # Get the log stream name, handling the case where it might be empty
    local stream_name
    stream_name=$(    aws logs describe-log-streams \
        --log-group-name "$log_group" \
        --max-items 5 \
        --endpoint-url=http://localhost:4566 \
        --query 'logStreams | sort_by(@, &lastEventTimestamp)[-1].logStreamName' \
        --output text 2>/dev/null)

    # Check if we got a valid stream name (AWS CLI returns "None" when no results)
    if [ "$stream_name" = "None" ] || [ -z "$stream_name" ] || [[ "$stream_name" == *"None"* ]]; then
        echo ""
    else
        echo "$stream_name"
    fi
}

# View logs for a specific function
view_logs() {
    local function_name="$1"
    local max_lines="${2:-50}"  # Default to 50 lines if not specified

    # Map short names to full function names
    case "$function_name" in
        "chat")
            function_name="about-me-chat-api"
            ;;
    esac

    if [ -z "$function_name" ]; then
        # Interactive selection
        echo "Which Lambda function logs would you like to view?"
        echo "1) chat - Chat API logs"
        echo ""

        while true; do
            read -p "Enter choice (1): " choice
        case $choice in
            1)
                view_logs "about-me-chat-api" "$max_lines"
                exit 0
                ;;
            *)
                warning "Please enter 1"
                ;;
        esac
        done
    fi

    log "Fetching logs for $function_name..."

    # Get the latest log stream
    local log_stream
    log_stream=$(get_latest_log_stream "$function_name")

    if [ -z "$log_stream" ]; then
        warning "No log streams found for $function_name"
        echo "Make sure the function has been invoked at least once."
        return
    fi

    success "Found log stream: $log_stream"

    # Get and display the logs
    echo ""
    echo "=== Recent logs for $function_name (showing last $max_lines events) ==="
    echo ""

    aws logs get-log-events \
        --log-group-name "/aws/lambda/$function_name" \
        --log-stream-name "$log_stream" \
        --endpoint-url=http://localhost:4566 \
        --limit "$max_lines" \
        --query 'events[].message' \
        --output text | while IFS= read -r line; do
            # Colorize log levels
            if echo "$line" | grep -q "ERROR"; then
                echo -e "${RED}$line${NC}"
            elif echo "$line" | grep -q "WARN"; then
                echo -e "${YELLOW}$line${NC}"
            elif echo "$line" | grep -q "INFO"; then
                echo -e "${GREEN}$line${NC}"
            else
                echo "$line"
            fi
        done

    echo ""
    success "Log viewing complete"
}

# List all log groups
list_log_groups() {
    log "Available log groups:"
    aws logs describe-log-groups \
        --endpoint-url=http://localhost:4566 \
        --query 'logGroups[].logGroupName' \
        --output table
}

# Main execution
main() {
    check_localstack

    # Parse arguments
    local function_name=""
    local max_lines="50"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --lines|-n)
                max_lines="$2"
                shift 2
                ;;
            --list|-l)
                list_log_groups
                exit 0
                ;;
            --help|-h)
                echo "View Lambda logs from LocalStack CloudWatch Logs"
                echo ""
                echo "Usage:"
                echo "  $0 [function] [options]    # View logs for specific function"
                echo "  $0                         # Interactive selection"
                echo ""
                echo "Options:"
                echo "  --lines, -n NUM           # Number of log events to show (default: 50)"
                echo "  --list, -l                 # List all log groups"
                echo "  --help, -h                 # Show this help"
                echo ""
                echo "Functions:"
                echo "  chat                       # Chat API logs"
                echo ""
                echo "Examples:"
                echo "  $0 chat                    # View last 50 chat logs"
                echo "  $0 chat --lines 20         # View last 20 chat logs"
                echo "  $0 chat -n 100             # View last 100 chat logs"
                echo "  $0 --list                  # Show all log groups"
                exit 0
                ;;
            *)
                if [ -z "$function_name" ]; then
                    function_name="$1"
                else
                    error "Unknown argument: $1"
                    echo "Use --help for usage information"
                    exit 1
                fi
                shift
                ;;
        esac
    done

    if [ -n "$function_name" ]; then
        view_logs "$function_name" "$max_lines"
    else
        select_lambda "$max_lines"
    fi
}

# Run main function
main "$@"