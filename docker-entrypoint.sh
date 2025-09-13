#!/bin/sh
# Docker entrypoint script for Lodgify MCP Server
# Handles signal forwarding, environment validation, and graceful shutdown

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color


# Function to log messages
log() {
    echo "${BLUE}[entrypoint]${NC} $1"
}

# Signal handling will be done by the MCP server process directly

log "${GREEN}Starting Lodgify MCP Server entrypoint...${NC}"

# Detect mode based on command
MODE="stdio"
if echo "$@" | grep -q "server-http"; then
    MODE="http"
fi

# Run environment validation if script exists
if [ -f "/app/scripts/env-check.sh" ]; then
    log "Running environment validation for $MODE mode..."
    # Don't fail on validation errors - just log them
    /app/scripts/env-check.sh $MODE || true
    log "${GREEN}Environment validation completed${NC}"
else
    log "${YELLOW}Environment validation script not found, skipping...${NC}"
fi

# Check file permissions for non-root user
log "Checking file permissions..."
if [ -w "/app" ]; then
    log "${GREEN}Write permissions verified${NC}"
else
    log "${YELLOW}Warning: Limited write permissions in /app${NC}"
fi

# Create necessary directories if they don't exist
if [ ! -d "/app/config" ]; then
    mkdir -p /app/config 2>/dev/null || log "${YELLOW}Could not create config directory${NC}"
fi

# Set up stdio handling for MCP communication
log "Configuring stdio for MCP protocol..."
export FORCE_COLOR=0  # Disable color output for clean MCP communication

# Pre-start health check
log "Performing pre-start checks..."

# Check if we're running in health check mode
if [ "$1" = "health-check" ]; then
    log "${GREEN}Starting health check server...${NC}"
    exec node /app/scripts/health-server.js
fi

# Check required environment variables based on mode
if [ -z "$LODGIFY_API_KEY" ] || [ "$LODGIFY_API_KEY" = "your_lodgify_api_key_here" ]; then
    log "${RED}ERROR: LODGIFY_API_KEY is not set or contains default value${NC}"
    log "${RED}Please set LODGIFY_API_KEY environment variable before starting${NC}"
    exit 1
fi

# Additional check for HTTP mode
if [ "$MODE" = "http" ]; then
    case "$AUTH_MODE" in
        bearer)
            if [ -z "$MCP_TOKEN" ] && [ -z "$AUTH_BEARER_TOKEN" ]; then
                log "${RED}ERROR: In AUTH_MODE=bearer, set MCP_TOKEN or AUTH_BEARER_TOKEN${NC}"
                exit 1
            fi
            ;;
        oauth|dual)
            # OAuth configuration will be validated by the server
            log "${GREEN}Using AUTH_MODE=$AUTH_MODE${NC}"
            ;;
        none)
            log "${YELLOW}WARNING: Authentication disabled (AUTH_MODE=none) - FOR DEVELOPMENT ONLY${NC}"
            log "${YELLOW}This mode should never be used in production!${NC}"
            ;;
        "")
            # Legacy behavior: require MCP_TOKEN if AUTH_MODE not set
            if [ -z "$MCP_TOKEN" ] || [ "$MCP_TOKEN" = "your-secret-token-here" ] || [ "$MCP_TOKEN" = "test-token-123" ]; then
                log "${RED}ERROR: MCP_TOKEN is not set or contains default/test value${NC}"
                log "${RED}Set AUTH_MODE or MCP_TOKEN for HTTP mode${NC}"
                exit 1
            fi
            ;;
    esac
fi

# Log startup configuration (without sensitive data)
log "Configuration:"
log "  MODE: $MODE"
log "  NODE_ENV: ${NODE_ENV:-production}"
log "  PORT: ${PORT:-3000}"
log "  LOG_LEVEL: ${LOG_LEVEL:-info}"
log "  DEBUG_HTTP: ${DEBUG_HTTP:-0}"
if [ "$MODE" = "http" ]; then
    log "  AUTH_MODE: ${AUTH_MODE:-bearer}"
    if [ "$AUTH_MODE" != "none" ]; then
        if [ -n "$MCP_TOKEN" ] || [ -n "$AUTH_BEARER_TOKEN" ]; then
            log "  MCP_TOKEN/AUTH_BEARER_TOKEN: [SET]"
        else
            log "  MCP_TOKEN/AUTH_BEARER_TOKEN: [NOT SET]"
        fi
    fi
fi

# Start MCP server directly in foreground
log "${GREEN}Starting MCP server...${NC}"

# Execute the main command directly (not in background)
# This allows proper stdio handling for MCP protocol
exec "$@"
