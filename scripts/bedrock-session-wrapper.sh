#!/bin/bash

# Simple script to extract current session token from ~/.aws/credentials
# and keep LocalStack Lambda containers using it

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDS_FILE="${HOME}/.aws/credentials"

function log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

function extract_and_show_credentials() {
    log "📋 Extracting credentials from ~/.aws/credentials..."
    
    if [ ! -f "$CREDS_FILE" ]; then
        log "❌ Credentials file not found: $CREDS_FILE"
        return 1
    fi
    
    # Extract from [default] profile
    ACCESS_KEY=$(grep -A 10 "^\[default\]" "$CREDS_FILE" | grep "aws_access_key_id" | cut -d= -f2 | xargs)
    SECRET_KEY=$(grep -A 10 "^\[default\]" "$CREDS_FILE" | grep "aws_secret_access_key" | cut -d= -f2 | xargs)
    SESSION_TOKEN=$(grep -A 10 "^\[default\]" "$CREDS_FILE" | grep "aws_session_token" | cut -d= -f2 | xargs)
    EXPIRY=$(grep -A 10 "^\[default\]" "$CREDS_FILE" | grep "x_security_token_expires" | cut -d= -f2 | xargs)
    
    if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ] || [ -z "$SESSION_TOKEN" ]; then
        log "❌ Could not extract credentials from $CREDS_FILE"
        return 1
    fi
    
    log "✅ Credentials extracted successfully"
    log "📍 Session expires: $EXPIRY"
    echo ""
    echo "=== Current AWS Session Credentials ==="
    echo "AWS_ACCESS_KEY_ID=$ACCESS_KEY"
    echo "AWS_SECRET_ACCESS_KEY=$SECRET_KEY"
    echo "AWS_SESSION_TOKEN=$SESSION_TOKEN"
    echo "======================================="
    echo ""
    log "💡 These credentials are now ready for LocalStack Lambda"
    log "⚠️  IMPORTANT: Session token expires at $EXPIRY"
    echo ""
    echo "To use with LocalStack, re-run setup:"
    echo "  ./setup-bedrock.sh real"
    echo ""
    echo "Or manually set environment before deploying:"
    echo "  export USE_REAL_BEDROCK=true"
    echo "  ./localstack-init.sh"
}

function check_expiry() {
    EXPIRY=$(grep -A 10 "^\[default\]" "$CREDS_FILE" | grep "x_security_token_expires" | cut -d= -f2 | xargs)
    EXPIRY_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$EXPIRY" +%s 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    SECONDS_LEFT=$((EXPIRY_EPOCH - NOW_EPOCH))
    
    if [ $SECONDS_LEFT -lt 0 ]; then
        log "❌ Session token EXPIRED"
        return 1
    else
        MINUTES_LEFT=$((SECONDS_LEFT / 60))
        log "✅ Session token valid for $MINUTES_LEFT more minutes"
        return 0
    fi
}

# Main entry point
case "${1:-extract}" in
    extract)
        extract_and_show_credentials
        ;;
    check)
        check_expiry
        ;;
    *)
        echo "Usage: $0 {extract|check}"
        echo ""
        echo "Commands:"
        echo "  extract - Show current AWS session credentials (default)"
        echo "  check   - Check if session token is still valid"
        exit 1
        ;;
esac
