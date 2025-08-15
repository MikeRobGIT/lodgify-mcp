# Troubleshooting Guide

Common issues and solutions for the Lodgify MCP Server.

## Logging and Debugging

### Log File Location
- **File**: `logs/lodgify-mcp-YYYY-MM-DD.log` (created automatically)
- **Format**: Structured JSON with timestamps, levels, and context
- **Security**: API keys and sensitive data automatically redacted

### Log Levels
Set `LOG_LEVEL` environment variable:
- `error`: Only critical errors
- `warn`: Warnings and errors
- `info`: General operational messages (default)
- `debug`: Detailed debugging information

### HTTP Debugging
Enable detailed request/response logging:
```bash
export DEBUG_HTTP=1
```
This logs full HTTP requests and responses (with sensitive data redacted).

### Example Log Analysis
```bash
# View recent errors
tail -f logs/lodgify-mcp-$(date +%Y-%m-%d).log | grep '"level":"error"'

# Monitor API calls
tail -f logs/lodgify-mcp-$(date +%Y-%m-%d).log | grep '"http"'

# Check server startup
head -20 logs/lodgify-mcp-$(date +%Y-%m-%d).log
```

## Common Issues

### "LODGIFY_API_KEY environment variable is required"
- **Check**: Ensure your `.env` file exists and contains a valid API key
- **Verify**: API key is not wrapped in extra quotes
- **Debug**: Check log file for specific validation errors

### JSON-RPC Error Responses
All errors now follow JSON-RPC 2.0 format. Check the `code` field:
- **-32602**: Invalid parameters (check your input data)
- **-32603**: Internal/API error (check API key, connectivity, Lodgify service status)

### 401 Unauthorized Errors
- **Verify**: API key is correct and active in your Lodgify account
- **Check**: API key permissions in your Lodgify account settings
- **Debug**: Look for "401" errors in log files with full context

### 429 Rate Limiting
- **Automatic**: Server automatically retries with exponential backoff
- **Monitor**: Check logs for "Max retries exceeded" messages
- **Action**: Consider reducing request frequency if consistently hitting limits

### Connection Errors
- **Verify**: Internet connectivity to `https://api.lodgify.com`
- **Check**: Firewall/proxy settings
- **Debug**: Look for "Request failed" messages in logs with network details

### MCP Client Not Finding Tools
- **Verify**: Server is running (check for "started successfully" in logs)
- **Check**: MCP configuration path is absolute
- **Action**: Restart your MCP client after configuration changes
- **Debug**: Look for startup errors or tool registration failures in logs

### STDIO Transport Issues
- **File Logging**: All output goes to log files, not console, preventing STDIO interference
- **No Console Output**: This is expected - all logging is file-based for MCP compatibility
- **Monitor**: Use `tail -f logs/lodgify-mcp-$(date +%Y-%m-%d).log` to monitor in real-time

### Availability Queries Issues
- **Raw availability returns "0001-01-01" dates**: This is expected. Use the new helper tools instead:
  - `lodgify_check_next_availability` for finding next available dates
  - `lodgify_check_date_range_availability` for checking specific dates
  - `lodgify_get_availability_calendar` for calendar views
- **Unexpected availability results**: The helper tools analyze actual bookings to determine availability, providing more accurate results than the raw API
- **Date format errors**: Always use YYYY-MM-DD format for dates (e.g., "2025-08-14")

## Docker-Specific Issues

### Container Won't Start
```bash
# Check container logs
docker logs lodgify-mcp

# Verify environment variables
docker run --rm lodgify-mcp:latest env

# Test with shell access
docker run -it --entrypoint sh lodgify-mcp:latest
```

### Environment Variable Issues
```bash
# Validate environment before starting
docker run --rm --env-file .env lodgify-mcp:latest /app/scripts/env-check.sh

# Check specific variables
docker run --rm -e LODGIFY_API_KEY="test" lodgify-mcp:latest env | grep LODGIFY
```

### Port Binding Issues
```bash
# Check if port is already in use
lsof -i :3000

# Use different port
docker run -p 8080:3000 lodgify-mcp:latest
```

### Resource Issues
```bash
# Check container resource usage
docker stats lodgify-mcp

# Limit resources
docker run --memory="512m" --cpus="1" lodgify-mcp:latest
```

## Development Issues

### Build Failures
```bash
# Clean build
rm -rf dist/ node_modules/
npm install
npm run build

# Check TypeScript errors
npm run typecheck
```

### Test Failures
```bash
# Run tests with verbose output
bun test --verbose

# Run specific test
bun test lodgify.test.ts

# Check test coverage
bun test --coverage
```

### Dependency Issues
```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

## Performance Issues

### Slow API Responses
- **Check**: Lodgify API status and response times
- **Monitor**: Enable DEBUG_HTTP=1 to see request timing
- **Optimize**: Implement request caching if appropriate

### High Memory Usage
- **Monitor**: Use `docker stats` or system monitoring tools
- **Debug**: Check for memory leaks in logs
- **Limit**: Set container memory limits

### Rate Limiting
- **Monitor**: Watch for 429 responses in logs
- **Adjust**: Implement request queuing or delays
- **Contact**: Lodgify support for higher rate limits if needed

## Getting Help

If you can't resolve an issue:

1. **Check logs** for detailed error messages
2. **Search issues** on the GitHub repository
3. **Create a bug report** with:
   - Log excerpts (with sensitive data removed)
   - Environment details (OS, Node.js/Bun version, etc.)
   - Steps to reproduce the issue
   - Expected vs. actual behavior

## Useful Commands

### Log Monitoring
```bash
# Real-time log monitoring
tail -f logs/lodgify-mcp-$(date +%Y-%m-%d).log

# Error-only monitoring
tail -f logs/lodgify-mcp-$(date +%Y-%m-%d).log | grep ERROR

# Search for specific errors
grep "LODGIFY_API_KEY" logs/lodgify-mcp-*.log
```

### Health Checks
```bash
# Check if server is responding (if running on port 3000)
curl -f http://localhost:3000/health || echo "Server not responding"

# Test MCP tools listing
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/server.js
```