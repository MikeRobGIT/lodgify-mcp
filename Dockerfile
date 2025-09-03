# Multi-stage Dockerfile for Lodgify MCP Server
# Stage 1: Build stage with all dependencies
FROM oven/bun:1-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lockb* ./

# Install all dependencies including dev dependencies
RUN bun install --frozen-lockfile

# Copy source code and other necessary files
COPY src ./src
COPY tsconfig.json ./

# Build the application
RUN bun run build

# Stage 2: Production runtime with minimal footprint
FROM oven/bun:1-alpine AS production

# Add metadata labels
LABEL maintainer="lodgify-mcp"
LABEL version="1.0.0"
LABEL description="Lodgify MCP Server - Model Context Protocol server for Lodgify API"

# Install curl for healthchecks
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1001 -S mcpuser && \
    adduser -u 1001 -S mcpuser -G mcpuser

# Set working directory
WORKDIR /app

# Copy only production dependencies and built files from builder
COPY --from=builder --chown=mcpuser:mcpuser /app/node_modules ./node_modules
COPY --from=builder --chown=mcpuser:mcpuser /app/dist ./dist
COPY --chown=mcpuser:mcpuser package.json ./

# Copy scripts
COPY --chown=mcpuser:mcpuser docker-entrypoint.sh /app/
COPY --chown=mcpuser:mcpuser scripts/env-check.sh /app/scripts/
COPY --chown=mcpuser:mcpuser scripts/health-server.js /app/scripts/
RUN chmod +x /app/docker-entrypoint.sh /app/scripts/env-check.sh /app/scripts/health-server.js

# Create directory for environment files (optional mounting point)
RUN mkdir -p /app/config && chown -R mcpuser:mcpuser /app/config

# Switch to non-root user
USER mcpuser

# Expose configurable port (default 3000, can be overridden)
ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}

# Health check configuration
# Check every 30 seconds, timeout after 10 seconds, start checking after 60 seconds
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Use entrypoint script for signal handling and environment setup
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command (can be overridden)
CMD ["bun", "run", "start"]