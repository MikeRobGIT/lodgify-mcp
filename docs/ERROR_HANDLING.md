# Error Handling

The server implements **JSON-RPC compliant error handling** with the high-level McpServer SDK:

## JSON-RPC Error Structure
All errors follow the standard JSON-RPC 2.0 error format:
```json
{
  "code": -32602,
  "message": "Invalid parameters: Missing required field 'id'",
  "data": {
    "originalError": "ValidationError",
    "details": "Property ID is required for this operation"
  }
}
```

## Error Code Mapping
- **-32700**: Parse Error (malformed JSON)
- **-32600**: Invalid Request (missing required fields)
- **-32601**: Method Not Found (unknown tool)
- **-32602**: Invalid Params (validation failures, missing required parameters)
- **-32603**: Internal Error (API failures, server errors, network issues)

## Lodgify API Error Handling
The server automatically maps Lodgify API errors to appropriate JSON-RPC codes:

### Rate Limiting (429)
- **Behavior**: Automatic retry with exponential backoff
- **Respects**: `Retry-After` header if present
- **Limits**: Maximum 5 retry attempts, 30-second max delay
- **Error Code**: `-32603` (Internal Error) if max retries exceeded

### Common Lodgify API Responses
- **400 Bad Request** → `-32602` Invalid Params
- **401 Unauthorized** → `-32603` Internal Error (check API key)
- **403 Forbidden** → `-32603` Internal Error (insufficient permissions)
- **404 Not Found** → `-32603` Internal Error (resource doesn't exist)
- **500 Internal Server Error** → `-32603` Internal Error

## Enhanced Error Context
Errors include full context for debugging:
```json
{
  "code": -32603,
  "message": "API Error: Lodgify 404: Property not found",
  "data": {
    "status": 404,
    "path": "/v2/properties/invalid-id",
    "method": "GET",
    "lodgifyError": {
      "code": "PROPERTY_NOT_FOUND",
      "message": "The specified property does not exist"
    }
  }
}
```

## Validation Error Examples
Input validation provides clear, actionable error messages:
```json
{
  "code": -32602,
  "message": "Invalid parameters",
  "data": {
    "validationErrors": [
      "Property ID must be a non-empty string",
      "Check-in date must be in YYYY-MM-DD format",
      "Check-out date must be after check-in date"
    ]
  }
}
```