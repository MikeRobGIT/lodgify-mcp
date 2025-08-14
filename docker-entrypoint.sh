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

# PID of the main process
MAIN_PID=""

# Function to log messages
log() {
    echo "${BLUE}[entrypoint]${NC} $1"
}

# Function to handle signals and forward to the main process
handle_signal() {
    SIGNAL=$1
    log "${YELLOW}Received $SIGNAL signal, forwarding to MCP server...${NC}"
    
    if [ -n "$MAIN_PID" ] && kill -0 "$MAIN_PID" 2>/dev/null; then
        kill -s "$SIGNAL" "$MAIN_PID"
        
        # Wait for graceful shutdown (max 30 seconds)
        WAIT_TIME=0
        while kill -0 "$MAIN_PID" 2>/dev/null && [ $WAIT_TIME -lt 30 ]; do
            sleep 1
            WAIT_TIME=$((WAIT_TIME + 1))
        done
        
        if kill -0 "$MAIN_PID" 2>/dev/null; then
            log "${RED}Process did not stop gracefully, forcing termination...${NC}"
            kill -9 "$MAIN_PID"
        else
            log "${GREEN}MCP server stopped gracefully${NC}"
        fi
    fi
    
    exit 0
}

# Trap signals for graceful shutdown
trap 'handle_signal TERM' TERM
trap 'handle_signal INT' INT
trap 'handle_signal QUIT' QUIT

log "${GREEN}Starting Lodgify MCP Server entrypoint...${NC}"

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

# Check if LODGIFY_API_KEY is set (only for MCP mode)
if [ -z "$LODGIFY_API_KEY" ] || [ "$LODGIFY_API_KEY" = "your_lodgify_api_key_here" ]; then
    log "${RED}ERROR: LODGIFY_API_KEY is not set or contains default value${NC}"
    log "${RED}Please set LODGIFY_API_KEY environment variable before starting${NC}"
    exit 1
fi

# Log startup configuration (without sensitive data)
log "Configuration:"
log "  NODE_ENV: ${NODE_ENV:-production}"
log "  PORT: ${PORT:-3000}"
log "  LOG_LEVEL: ${LOG_LEVEL:-info}"
log "  DEBUG_HTTP: ${DEBUG_HTTP:-0}"

# Retry logic for startup (useful for dependent services)
MAX_RETRIES=3
RETRY_COUNT=0
START_SUCCESS=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ $START_SUCCESS -eq 0 ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        log "Retry attempt $RETRY_COUNT of $MAX_RETRIES..."
        sleep 2
    fi
    
    log "${GREEN}Starting MCP server...${NC}"
    
    # Execute the main command in background to capture PID
    "$@" &
    MAIN_PID=$!
    
    # Wait a moment to check if process started successfully
    sleep 2
    
    if kill -0 "$MAIN_PID" 2>/dev/null; then
        START_SUCCESS=1
        log "${GREEN}MCP server started successfully (PID: $MAIN_PID)${NC}"
    else
        log "${RED}Failed to start MCP server${NC}"
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ $START_SUCCESS -eq 0 ]; then
    log "${RED}Failed to start MCP server after $MAX_RETRIES attempts${NC}"
    exit 1
fi

# Wait for the main process to complete
wait "$MAIN_PID"
EXIT_CODE=$?

log "MCP server exited with code $EXIT_CODE"
exit $EXIT_CODE