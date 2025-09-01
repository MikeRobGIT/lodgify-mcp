# Security Documentation

## Overview

This document outlines the security measures implemented in the Lodgify MCP server to ensure safe and controlled access to the Lodgify API.

## Read-Only Mode Enforcement

### Overview

The Lodgify MCP server implements comprehensive read-only mode enforcement to prevent accidental or unauthorized write operations. When read-only mode is enabled, all write operations (POST, PUT, PATCH, DELETE) are blocked before any network requests are made.

### Configuration

Read-only mode can be enabled through:

1. **Environment Variable**: Set `LODGIFY_READ_ONLY=1` or `LODGIFY_READ_ONLY=true`
2. **Constructor Parameter**: Pass `readOnly: true` when creating the `LodgifyOrchestrator`

```typescript
// Environment variable method
process.env.LODGIFY_READ_ONLY = '1'

// Constructor parameter method
const client = new LodgifyOrchestrator({
  apiKey: 'your-api-key',
  readOnly: true
})
```

### Enforcement Points

The read-only enforcement is implemented at multiple layers to ensure comprehensive protection:

#### 1. Base API Client Level (`BaseApiClient.request()`)

All HTTP requests go through the base client's `request()` method, which checks the HTTP method before making any network calls:

```typescript
// Check read-only mode for write operations
const writeOperations = ['POST', 'PUT', 'PATCH', 'DELETE']
if (this.readOnly && writeOperations.includes(method.toUpperCase())) {
  throw ReadOnlyModeError.forApiOperation(
    method.toUpperCase(),
    versionedPath,
    `${method.toUpperCase()} ${versionedPath}`,
  )
}
```

#### 2. Orchestrator Level (`LodgifyOrchestrator`)

The main orchestrator includes a `checkReadOnly()` method that's called in all backward compatibility methods:

```typescript
private checkReadOnly(operation: string, path: string): void {
  if (this.readOnly) {
    throw ReadOnlyModeError.forApiOperation('POST', path, operation)
  }
}
```

#### 3. Batch Operations (`ApiClientOrchestrator.batch()`)

Batch operations are checked for write operations before execution:

```typescript
// Check for write operations in read-only mode
if (this.readOnly) {
  const writeOperations = operations.filter((op) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(op.method.toUpperCase()),
  )
  if (writeOperations.length > 0) {
    throw ReadOnlyModeError.forApiOperation(
      writeOperations[0].method.toUpperCase(),
      writeOperations[0].path,
      `Batch operation containing ${writeOperations.length} write operations`,
    )
  }
}
```

#### 4. Retry Handler (`ExponentialBackoffRetry`)

The retry handler respects read-only mode and won't retry write operations that would fail anyway:

```typescript
// In read-only mode, don't retry write operations
if (this.readOnly && this.isWriteOperationError(error)) {
  return {
    success: false,
    error,
    attempts: attempt + 1,
  }
}
```

### Protected Operations

The following operations are blocked in read-only mode:

#### Booking Operations
- `createBooking()` - Create new bookings
- `updateBooking()` - Modify existing bookings
- `deleteBooking()` - Cancel/delete bookings
- `checkinBooking()` - Mark bookings as checked in
- `checkoutBooking()` - Mark bookings as checked out
- `createBookingPaymentLink()` - Generate payment links
- `updateKeyCodes()` - Update access codes

#### Rate Operations
- `createRate()` - Create new rates
- `updateRate()` - Modify existing rates
- `updateRatesV1()` - Update rates via V1 API

#### Webhook Operations
- `subscribeWebhook()` - Subscribe to webhook events
- `unsubscribeWebhook()` - Unsubscribe from webhook events
- `deleteWebhook()` - Delete webhook subscriptions

#### Messaging Operations
- `sendMessage()` - Send messages to threads
- `markThreadAsRead()` - Mark threads as read
- `archiveThread()` - Archive message threads

#### Availability Operations
- `updatePropertyAvailability()` - Update property availability settings

#### V1 API Operations
- `createBookingV1()` - Create bookings via V1 API
- `updateBookingV1()` - Update bookings via V1 API
- `deleteBookingV1()` - Delete bookings via V1 API

### Allowed Operations

The following read operations are always allowed, even in read-only mode:

- `listProperties()` - List all properties
- `getProperty()` - Get property details
- `listPropertyRooms()` - List property room types
- `listBookings()` - List all bookings
- `getBooking()` - Get booking details
- `getDailyRates()` - Get rate information
- `getRateSettings()` - Get rate configuration
- `getQuote()` - Get booking quotes
- `getThread()` - Get message threads
- `listWebhooks()` - List webhook subscriptions
- `getBookingPaymentLink()` - Get existing payment links
- `getExternalBookings()` - Get external booking data
- All availability query operations

### Error Handling

When a write operation is attempted in read-only mode, a `ReadOnlyModeError` is thrown with:

- **Status Code**: 403 (Forbidden)
- **Message**: Clear explanation of the restriction
- **Detail**: Operation information and guidance on how to enable write mode
- **Path**: The API endpoint that was blocked

Example error:
```json
{
  "error": true,
  "status": 403,
  "message": "Write operation 'Create Booking' is not allowed in read-only mode. Set LODGIFY_READ_ONLY=0 to enable write operations.",
  "path": "/v2/reservations/bookings",
  "detail": {
    "operation": "Create Booking",
    "method": "POST",
    "endpoint": "/v2/reservations/bookings",
    "readOnlyMode": true,
    "suggestion": "Set LODGIFY_READ_ONLY=0 or remove the environment variable to enable write operations"
  }
}
```

### Testing

Comprehensive tests ensure read-only enforcement works correctly:

- **Base Client Tests**: Verify HTTP method blocking
- **Orchestrator Tests**: Verify backward compatibility method blocking
- **Module Tests**: Verify all API module write operations are blocked
- **Batch Tests**: Verify batch operations with write requests are blocked
- **Retry Tests**: Verify retry handler respects read-only mode
- **Error Tests**: Verify proper error messages and structure

### Best Practices

1. **Default to Read-Only**: Use read-only mode by default in production environments
2. **Environment Variables**: Use `LODGIFY_READ_ONLY=1` for production deployments
3. **Testing**: Always test write operations in a safe environment first
4. **Monitoring**: Monitor for read-only errors to identify unauthorized write attempts
5. **Documentation**: Clearly document when read-only mode is enabled in your deployment

### Disabling Read-Only Mode

To enable write operations:

1. **Environment Variable**: Set `LODGIFY_READ_ONLY=0` or remove the variable entirely
2. **Constructor Parameter**: Pass `readOnly: false` or omit the parameter

```typescript
// Enable write operations
process.env.LODGIFY_READ_ONLY = '0'

// Or in constructor
const client = new LodgifyOrchestrator({
  apiKey: 'your-api-key',
  readOnly: false // or omit this line
})
```

## API Key Security

### Storage

API keys should be stored securely:

1. **Environment Variables**: Store in `.env` files (not committed to version control)
2. **Secrets Management**: Use your platform's secrets management system
3. **Rotation**: Regularly rotate API keys
4. **Access Control**: Limit access to API keys to authorized personnel only

### Validation

The server validates API keys:

1. **Required**: API keys are required for all operations
2. **Format**: Basic format validation is performed
3. **Authentication**: Invalid keys result in 401 Unauthorized responses

## Rate Limiting

### Implementation

The server implements rate limiting to prevent API abuse:

1. **Sliding Window**: Uses a sliding window algorithm
2. **Configurable**: Rate limits can be adjusted per environment
3. **Automatic Retry**: Failed requests due to rate limiting are automatically retried
4. **Exponential Backoff**: Retry delays increase exponentially

### Limits

Default rate limits:
- **Window**: 60 seconds
- **Requests**: 60 requests per window
- **Retry Delay**: Up to 30 seconds maximum

## Error Handling

### Security Considerations

1. **No Sensitive Data**: Error messages never contain API keys or sensitive information
2. **Sanitization**: All error details are sanitized before logging
3. **Consistent Format**: All errors follow a consistent JSON-RPC compliant format
4. **Stack Traces**: Stack traces are only included in development mode

### Error Types

1. **Validation Errors**: 400 Bad Request for invalid input
2. **Authentication Errors**: 401 Unauthorized for invalid API keys
3. **Authorization Errors**: 403 Forbidden for read-only mode violations
4. **Rate Limit Errors**: 429 Too Many Requests for rate limit violations
5. **Server Errors**: 5xx for Lodgify API server errors

## Logging

### Security Logging

1. **No Sensitive Data**: API keys and sensitive data are never logged
2. **Request Logging**: HTTP requests are logged with sensitive data redacted
3. **Error Logging**: All errors are logged with sanitized details
4. **Audit Trail**: All operations create an audit trail

### Log Levels

- **Error**: All errors and security violations
- **Warn**: Rate limiting and retry attempts
- **Info**: Successful operations and configuration changes
- **Debug**: Detailed request/response information (only when `DEBUG_HTTP=1`)

## Network Security

### HTTPS Enforcement

1. **TLS Required**: All API calls use HTTPS/TLS encryption
2. **Certificate Validation**: Server certificates are validated
3. **No HTTP Fallback**: HTTP requests are not allowed

### Timeout Configuration

1. **Request Timeouts**: 30-second default timeout for all requests
2. **Configurable**: Timeouts can be adjusted per environment
3. **Retry Logic**: Timeout errors trigger automatic retry with backoff

## Best Practices Summary

1. **Use Read-Only Mode**: Enable read-only mode in production by default
2. **Secure API Keys**: Store API keys securely and rotate regularly
3. **Monitor Usage**: Monitor API usage and error rates
4. **Test Safely**: Always test write operations in safe environments
5. **Handle Errors**: Implement proper error handling for all operations
6. **Log Securely**: Ensure logs don't contain sensitive information
7. **Rate Limiting**: Respect rate limits and implement proper retry logic
8. **HTTPS Only**: Never use HTTP for API communications
