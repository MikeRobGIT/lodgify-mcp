#!/bin/bash
# MCPO Startup Script for Lodgify MCP Server
# Handles local development and production MCPO proxy startup

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    echo -e "${BLUE}[mcpo-start]${NC} $1"
}

error() {
    echo -e "${RED}[mcpo-start ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[mcpo-start]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[mcpo-start WARN]${NC} $1"
}

# Default configuration
DEFAULT_PORT=8000
DEFAULT_CONFIG="mcpo.config.json"
DEFAULT_API_KEY="mcpo-default-key"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] [COMMAND]

MCPO startup script for Lodgify MCP Server

OPTIONS:
    -p, --port PORT         Set MCPO port (default: $DEFAULT_PORT)
    -c, --config CONFIG     Set config file path (default: $DEFAULT_CONFIG)
    -k, --api-key KEY       Set API key for MCPO (default: generated)
    -e, --env ENV           Set environment (dev, prod) (default: auto-detect)
    -d, --debug             Enable debug mode
    -h, --help              Show this help message

COMMANDS:
    start                   Start MCPO proxy (default)
    stop                    Stop running MCPO proxy
    restart                 Restart MCPO proxy
    status                  Check MCPO proxy status
    logs                    Show MCPO logs
    test                    Test MCPO endpoints

EXAMPLES:
    $0                      Start MCPO with default settings
    $0 -p 9000 -d           Start MCPO on port 9000 with debug
    $0 -c mcpo.dev.json     Start MCPO with development config
    $0 stop                 Stop running MCPO proxy
    $0 status               Check if MCPO is running

ENVIRONMENT VARIABLES:
    LODGIFY_API_KEY         Required: Lodgify API key
    MCPO_PORT               MCPO proxy port
    MCPO_CONFIG             MCPO configuration file
    MCPO_API_KEY            MCPO API key for authentication
    LOG_LEVEL               Log level (debug, info, warn, error)
    NODE_ENV                Environment (development, production)

EOF
}

# Function to check if MCPO is installed
check_mcpo() {
    if ! command -v mcpo > /dev/null 2>&1; then
        error "MCPO is not installed. Please install it first:"
        error "  pip install mcpo"
        error "  or"
        error "  uvx mcpo --help"
        return 1
    fi
    return 0
}

# Function to validate environment
validate_environment() {
    log "Validating environment..."
    
    # Check for required API key
    if [ -z "$LODGIFY_API_KEY" ] || [ "$LODGIFY_API_KEY" = "your_lodgify_api_key_here" ]; then
        error "LODGIFY_API_KEY is not set or contains default value"
        error "Please set LODGIFY_API_KEY environment variable"
        return 1
    fi
    
    # Check if config file exists
    if [ ! -f "$CONFIG_FILE" ]; then
        error "Configuration file not found: $CONFIG_FILE"
        error "Available config files:"
        ls -la "$PROJECT_ROOT"/mcpo*.json 2>/dev/null || error "  No MCPO config files found"
        return 1
    fi
    
    success "Environment validation passed"
    return 0
}

# Function to substitute environment variables in config
prepare_config() {
    local config_file="$1"
    local temp_config="/tmp/mcpo-config-$$.json"
    
    log "Preparing configuration file..."
    
    # Create temporary config with environment variable substitution
    sed "s/your_lodgify_api_key_here/$LODGIFY_API_KEY/g" "$config_file" > "$temp_config"
    
    # Validate JSON syntax
    if command -v jq > /dev/null 2>&1; then
        if ! jq empty < "$temp_config" >/dev/null 2>&1; then
            error "Invalid JSON in configuration file: $config_file"
            rm -f "$temp_config"
            return 1
        fi
    fi
    
    echo "$temp_config"
    return 0
}

# Function to start MCPO
start_mcpo() {
    log "Starting MCPO proxy..."
    
    # Prepare configuration
    local temp_config
    if ! temp_config=$(prepare_config "$CONFIG_FILE"); then
        return 1
    fi
    
    # Log configuration (without sensitive data)
    log "Configuration:"
    log "  Port: $MCPO_PORT"
    log "  Config: $CONFIG_FILE"
    log "  API Key: [REDACTED]"
    log "  Environment: ${NODE_ENV:-auto}"
    log "  Log Level: ${LOG_LEVEL:-info}"
    
    # Build MCPO command
    local mcpo_cmd=(
        mcpo
        --port "$MCPO_PORT"
        --api-key "$MCPO_API_KEY"
        --config "$temp_config"
    )
    
    # Add debug flag if requested
    if [ "$DEBUG_MODE" = "true" ]; then
        mcpo_cmd+=(--debug)
    fi
    
    # Add hot-reload for development
    if [ "$NODE_ENV" = "development" ]; then
        mcpo_cmd+=(--hot-reload)
    fi
    
    success "Starting MCPO with command: ${mcpo_cmd[*]}"
    
    # Create PID file directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Start MCPO
    if [ "$BACKGROUND" = "true" ]; then
        # Start in background with logging
        "${mcpo_cmd[@]}" > "$PROJECT_ROOT/logs/mcpo.log" 2>&1 &
        echo $! > "$PROJECT_ROOT/logs/mcpo.pid"
        success "MCPO started in background (PID: $!)"
        success "View logs: tail -f $PROJECT_ROOT/logs/mcpo.log"
        success "OpenAPI docs: http://localhost:$MCPO_PORT/docs"
    else
        # Start in foreground
        success "MCPO will start in foreground. Press Ctrl+C to stop."
        success "OpenAPI docs will be available at: http://localhost:$MCPO_PORT/docs"
        
        # Cleanup function for foreground mode
        cleanup() {
            log "Shutting down MCPO..."
            rm -f "$temp_config"
            exit 0
        }
        trap cleanup INT TERM
        
        # Execute MCPO
        exec "${mcpo_cmd[@]}"
    fi
    
    # Cleanup temporary config in background mode
    if [ "$BACKGROUND" = "true" ]; then
        # Schedule cleanup of temp config after a delay
        (sleep 10 && rm -f "$temp_config") &
    fi
}

# Function to stop MCPO
stop_mcpo() {
    log "Stopping MCPO proxy..."
    
    local pid_file="$PROJECT_ROOT/logs/mcpo.pid"
    
    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid"
            sleep 2
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                warn "MCPO did not stop gracefully, forcing shutdown..."
                kill -KILL "$pid"
            fi
            
            rm -f "$pid_file"
            success "MCPO stopped"
        else
            warn "MCPO process not running (stale PID file)"
            rm -f "$pid_file"
        fi
    else
        warn "MCPO PID file not found"
        # Try to find and kill MCPO processes
        if pgrep -f "mcpo.*--port.*$DEFAULT_PORT" > /dev/null; then
            warn "Found running MCPO processes, attempting to stop..."
            pkill -f "mcpo.*--port.*$DEFAULT_PORT"
            sleep 1
            success "MCPO processes stopped"
        else
            log "No MCPO processes found"
        fi
    fi
}

# Function to check MCPO status
check_status() {
    log "Checking MCPO status..."
    
    local pid_file="$PROJECT_ROOT/logs/mcpo.pid"
    
    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            success "MCPO is running (PID: $pid)"
            success "REST API: http://localhost:$MCPO_PORT"
            success "OpenAPI docs: http://localhost:$MCPO_PORT/docs"
            
            # Test API endpoint
            if command -v curl > /dev/null 2>&1; then
                if curl -s -f "http://localhost:$MCPO_PORT/docs" > /dev/null; then
                    success "API is responding"
                else
                    warn "API is not responding"
                fi
            fi
            return 0
        else
            warn "MCPO PID file exists but process not running"
            rm -f "$pid_file"
            return 1
        fi
    else
        log "MCPO is not running"
        return 1
    fi
}

# Function to show logs
show_logs() {
    local log_file="$PROJECT_ROOT/logs/mcpo.log"
    
    if [ -f "$log_file" ]; then
        log "Showing MCPO logs (last 50 lines):"
        tail -n 50 "$log_file"
        
        if [ "$FOLLOW_LOGS" = "true" ]; then
            log "Following logs (Ctrl+C to stop):"
            tail -f "$log_file"
        fi
    else
        warn "Log file not found: $log_file"
    fi
}

# Function to test MCPO endpoints
test_mcpo() {
    log "Testing MCPO endpoints..."
    
    local base_url="http://localhost:$MCPO_PORT"
    
    if ! command -v curl > /dev/null 2>&1; then
        error "curl is required for testing endpoints"
        return 1
    fi
    
    # Test health endpoint
    log "Testing health endpoint..."
    if curl -s -f "$base_url/health" > /dev/null; then
        success "✓ Health endpoint responding"
    else
        error "✗ Health endpoint not responding"
    fi
    
    # Test docs endpoint
    log "Testing docs endpoint..."
    if curl -s -f "$base_url/docs" > /dev/null; then
        success "✓ OpenAPI docs available"
    else
        warn "✗ OpenAPI docs not available"
    fi
    
    # Test OpenAPI spec
    log "Testing OpenAPI spec..."
    if curl -s -f "$base_url/openapi.json" > /dev/null; then
        success "✓ OpenAPI specification available"
    else
        warn "✗ OpenAPI specification not available"
    fi
    
    log "Test complete. Visit $base_url/docs for interactive API documentation"
}

# Parse command line arguments
MCPO_PORT=${MCPO_PORT:-$DEFAULT_PORT}
CONFIG_FILE="$DEFAULT_CONFIG"
MCPO_API_KEY=${MCPO_API_KEY:-$DEFAULT_API_KEY}
DEBUG_MODE=${DEBUG_MODE:-false}
BACKGROUND=${BACKGROUND:-true}
COMMAND="start"

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            MCPO_PORT="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -k|--api-key)
            MCPO_API_KEY="$2"
            shift 2
            ;;
        -e|--env)
            NODE_ENV="$2"
            shift 2
            ;;
        -d|--debug)
            DEBUG_MODE=true
            shift
            ;;
        -f|--foreground)
            BACKGROUND=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        start|stop|restart|status|logs|test)
            COMMAND="$1"
            shift
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Change to project root
cd "$PROJECT_ROOT"

# Make config file path absolute if relative
if [[ ! "$CONFIG_FILE" = /* ]]; then
    CONFIG_FILE="$PROJECT_ROOT/$CONFIG_FILE"
fi

# Auto-detect environment if not set
if [ -z "$NODE_ENV" ]; then
    if [ -f ".env.development" ] || [ -f "mcpo.dev.json" ]; then
        NODE_ENV="development"
    else
        NODE_ENV="production"
    fi
fi

# Load environment file if it exists
if [ -f ".env" ]; then
    log "Loading environment from .env"
    set -o allexport
    source .env
    set +o allexport
fi

# Execute command
case $COMMAND in
    start)
        if ! check_mcpo; then
            exit 1
        fi
        if ! validate_environment; then
            exit 1
        fi
        start_mcpo
        ;;
    stop)
        stop_mcpo
        ;;
    restart)
        stop_mcpo
        sleep 2
        if ! check_mcpo; then
            exit 1
        fi
        if ! validate_environment; then
            exit 1
        fi
        start_mcpo
        ;;
    status)
        check_status
        ;;
    logs)
        FOLLOW_LOGS=true show_logs
        ;;
    test)
        test_mcpo
        ;;
    *)
        error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac