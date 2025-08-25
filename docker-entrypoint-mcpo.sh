#!/bin/sh
# Docker entrypoint script for Lodgify MCP Server with MCPO
# Handles both MCP server and MCPO proxy startup with proper signal handling

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    echo "${BLUE}[mcpo-entrypoint]${NC} $1"
}

# PID tracking for background processes
MCP_PID=""
MCPO_PID=""

# Cleanup function for graceful shutdown
cleanup() {
    log "${YELLOW}Shutting down services...${NC}"
    
    if [ -n "$MCPO_PID" ]; then
        log "Stopping MCPO proxy (PID: $MCPO_PID)"
        kill -TERM "$MCPO_PID" 2>/dev/null || true
        wait "$MCPO_PID" 2>/dev/null || true
    fi
    
    if [ -n "$MCP_PID" ]; then
        log "Stopping MCP server (PID: $MCP_PID)"
        kill -TERM "$MCP_PID" 2>/dev/null || true  
        wait "$MCP_PID" 2>/dev/null || true
    fi
    
    log "${GREEN}Cleanup completed${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup TERM INT QUIT

log "${GREEN}Starting Lodgify MCP Server with MCPO entrypoint...${NC}"

# Run environment validation if script exists
if [ -f "/app/scripts/env-check.sh" ]; then
    log "Running environment validation..."
    if /app/scripts/env-check.sh; then
        log "${GREEN}Environment validation passed${NC}"
    else
        log "${YELLOW}Environment validation completed with warnings${NC}"
    fi
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

# Create necessary directories
mkdir -p /app/config /app/logs 2>/dev/null || true

# Check for MCPO mode vs direct MCP mode
if [ "$1" = "mcpo" ] || [ "$1" = "mcpo-start" ]; then
    # MCPO proxy mode
    log "Starting in MCPO proxy mode..."
    
    # Check if LODGIFY_API_KEY is set
    if [ -z "$LODGIFY_API_KEY" ] || [ "$LODGIFY_API_KEY" = "your_lodgify_api_key_here" ]; then
        log "${RED}ERROR: LODGIFY_API_KEY is not set or contains default value${NC}"
        log "${RED}Please set LODGIFY_API_KEY environment variable before starting${NC}"
        exit 1
    fi
    
    # Set default configuration file if not specified
    MCPO_CONFIG="${MCPO_CONFIG:-/app/mcpo.config.json}"
    MCPO_PORT="${MCPO_PORT:-8000}"
    MCPO_API_KEY="${MCPO_API_KEY:-mcpo-secret-key}"
    
    # Log startup configuration (without sensitive data)
    log "MCPO Configuration:"
    log "  Config file: $MCPO_CONFIG"
    log "  Port: $MCPO_PORT"
    log "  API Key: [REDACTED]"
    log "  LOG_LEVEL: ${LOG_LEVEL:-info}"
    
    # Validate configuration file exists
    if [ ! -f "$MCPO_CONFIG" ]; then
        log "${RED}ERROR: MCPO config file not found: $MCPO_CONFIG${NC}"
        exit 1
    fi
    
    # Update configuration file with current environment variables
    if command -v sed > /dev/null 2>&1; then
        # Create a temporary config with environment variables substituted
        TEMP_CONFIG="/tmp/mcpo.config.json"
        sed "s/your_lodgify_api_key_here/$LODGIFY_API_KEY/g" "$MCPO_CONFIG" > "$TEMP_CONFIG"
        MCPO_CONFIG="$TEMP_CONFIG"
        log "Updated configuration with environment variables"
    fi
    
    # Start MCPO proxy
    log "${GREEN}Starting MCPO proxy on port $MCPO_PORT...${NC}"
    
    # Execute MCPO with all provided arguments
    shift # Remove 'mcpo' from arguments
    exec mcpo --port "$MCPO_PORT" --api-key "$MCPO_API_KEY" --config "$MCPO_CONFIG" "$@"
    
elif [ "$1" = "health-check" ]; then
    # Health check mode
    log "${GREEN}Starting health check server...${NC}"
    exec node /app/scripts/health-server.js
    
else
    # Direct MCP mode (fallback to original behavior)
    log "Starting in direct MCP mode..."
    
    # Check if LODGIFY_API_KEY is set
    if [ -z "$LODGIFY_API_KEY" ] || [ "$LODGIFY_API_KEY" = "your_lodgify_api_key_here" ]; then
        log "${RED}ERROR: LODGIFY_API_KEY is not set or contains default value${NC}"
        log "${RED}Please set LODGIFY_API_KEY environment variable before starting${NC}"
        exit 1
    fi
    
    # Set up stdio handling for MCP communication
    log "Configuring stdio for MCP protocol..."
    export FORCE_COLOR=0  # Disable color output for clean MCP communication
    
    # Log startup configuration (without sensitive data)
    log "MCP Configuration:"
    log "  NODE_ENV: ${NODE_ENV:-production}"
    log "  PORT: ${PORT:-3000}"
    log "  LOG_LEVEL: ${LOG_LEVEL:-info}"
    log "  DEBUG_HTTP: ${DEBUG_HTTP:-0}"
    
    # Start MCP server directly
    log "${GREEN}Starting MCP server...${NC}"
    exec "$@"
fi