#!/bin/sh
# Environment variable validation script for Docker deployments

set -e

echo "🔍 Validating environment variables for Lodgify MCP Server..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation counters
ERRORS=0
WARNINGS=0

# Function to check required variables
check_required() {
    VAR_NAME=$1
    VAR_VALUE=$(eval echo \$$VAR_NAME)
    
    if [ -z "$VAR_VALUE" ] || [ "$VAR_VALUE" = "your_lodgify_api_key_here" ]; then
        echo "${RED}❌ ERROR: $VAR_NAME is not set or contains default value${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    else
        echo "${GREEN}✅ $VAR_NAME is set${NC}"
        return 0
    fi
}

# Function to check optional variables
check_optional() {
    VAR_NAME=$1
    DEFAULT_VALUE=$2
    VAR_VALUE=$(eval echo \$$VAR_NAME)
    
    if [ -z "$VAR_VALUE" ]; then
        echo "${YELLOW}⚠️  WARNING: $VAR_NAME is not set, using default: $DEFAULT_VALUE${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "${GREEN}✅ $VAR_NAME is set to: $VAR_VALUE${NC}"
    fi
}

# Function to validate enum values
check_enum() {
    VAR_NAME=$1
    VAR_VALUE=$(eval echo \$$VAR_NAME)
    shift
    VALID_VALUES="$@"
    
    # Strip quotes and everything after # (comments)
    # Using simpler approach to avoid shell parsing issues
    VAR_VALUE=$(echo "$VAR_VALUE" | cut -d'#' -f1 | sed 's/^"//' | sed 's/"$//' | sed "s/^'//" | sed "s/'$//" | sed 's/[[:space:]]*$//')
    
    if [ -z "$VAR_VALUE" ]; then
        echo "${YELLOW}⚠️  WARNING: $VAR_NAME is not set${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
    
    FOUND=0
    for VALID in $VALID_VALUES; do
        if [ "$VAR_VALUE" = "$VALID" ]; then
            FOUND=1
            break
        fi
    done
    
    if [ $FOUND -eq 1 ]; then
        echo "${GREEN}✅ $VAR_NAME has valid value: $VAR_VALUE${NC}"
    else
        echo "${RED}❌ ERROR: $VAR_NAME has invalid value: $VAR_VALUE (valid: $VALID_VALUES)${NC}"
        ERRORS=$((ERRORS + 1))
    fi
}

echo ""
echo "Checking required environment variables..."
echo "=========================================="

# Required variables
check_required "LODGIFY_API_KEY"

# Check for HTTP mode requirements
if [ "$1" = "http" ]; then
    echo ""
    echo "HTTP transport mode detected..."
    AUTH_MODE_EFFECTIVE=${AUTH_MODE:-}
    case "$AUTH_MODE_EFFECTIVE" in
        bearer)
            # In bearer mode, require a token (either MCP_TOKEN or AUTH_BEARER_TOKEN)
            if [ -z "$MCP_TOKEN" ] && [ -z "$AUTH_BEARER_TOKEN" ]; then
                echo "${RED}❌ ERROR: In AUTH_MODE=bearer, MCP_TOKEN or AUTH_BEARER_TOKEN must be set${NC}"
                ERRORS=$((ERRORS + 1))
            else
                echo "${GREEN}✅ Bearer token present for HTTP mode${NC}"
            fi
            ;;
        oauth|dual)
            echo "${GREEN}✅ Running HTTP mode with AUTH_MODE=$AUTH_MODE_EFFECTIVE${NC}"
            echo "${YELLOW}⚠️  OAuth configuration will be validated by the server${NC}"
            WARNINGS=$((WARNINGS + 1))
            ;;
        none)
            echo "${YELLOW}⚠️  WARNING: Authentication disabled (AUTH_MODE=none)${NC}"
            echo "${YELLOW}⚠️  This mode should NEVER be used in production!${NC}"
            echo "${YELLOW}⚠️  FOR DEVELOPMENT/TESTING ONLY${NC}"
            WARNINGS=$((WARNINGS + 3))
            ;;
        "")
            # Legacy default: require MCP_TOKEN if no AUTH_MODE specified
            if [ -z "$MCP_TOKEN" ]; then
                echo "${RED}❌ ERROR: MCP_TOKEN is required for HTTP mode when AUTH_MODE is not set${NC}"
                ERRORS=$((ERRORS + 1))
            else
                echo "${GREEN}✅ MCP_TOKEN present (legacy mode)${NC}"
            fi
            ;;
    esac
fi

echo ""
echo "Checking optional environment variables..."
echo "=========================================="

# Optional variables with defaults
check_optional "NODE_ENV" "production"
check_optional "DOCKER_PORT" "3000"
check_optional "LOG_LEVEL" "info"
check_optional "DEBUG_HTTP" "0"

echo ""
echo "Validating environment variable values..."
echo "=========================================="

# Validate enums
if [ -n "$NODE_ENV" ]; then
    check_enum "NODE_ENV" "development" "production"
fi

if [ -n "$LOG_LEVEL" ]; then
    check_enum "LOG_LEVEL" "error" "warn" "info" "debug"
fi

echo ""
echo "Checking network connectivity..."
echo "=========================================="

# Check if we can reach Lodgify API (without making an actual API call)
if command -v nc >/dev/null 2>&1; then
    if nc -zv api.lodgify.com 443 2>/dev/null; then
        echo "${GREEN}✅ Can reach api.lodgify.com${NC}"
    else
        echo "${YELLOW}⚠️  WARNING: Cannot reach api.lodgify.com (might be a network issue)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "${YELLOW}⚠️  Skipping network check (nc not available)${NC}"
fi

echo ""
echo "=========================================="
echo "Validation Summary:"
echo "=========================================="

if [ $ERRORS -gt 0 ]; then
    echo "${RED}❌ Found $ERRORS error(s) - Please fix before starting the server${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo "${YELLOW}⚠️  Found $WARNINGS warning(s) - Server will start with defaults${NC}"
    exit 0
else
    echo "${GREEN}✅ All environment variables validated successfully!${NC}"
    exit 0
fi
