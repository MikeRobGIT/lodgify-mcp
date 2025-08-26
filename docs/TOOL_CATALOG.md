# Lodgify MCP Tool Catalog

Complete reference for all available Lodgify MCP tools and their parameters.

## Property Management

### `lodgify.list_properties`
List all properties with optional filtering and pagination.

**Parameters:**
- `params` (optional): Query parameters for filtering
  - `page`: Page number
  - `limit`: Results per page
  - `includeDeleted`: Include deleted properties

**Example:**
```javascript
{
  "params": {
    "page": 1,
    "limit": 10,
    "includeDeleted": false
  }
}
```

### `lodgify.get_property`
Get detailed information about a specific property.

**Parameters:**
- `id` (required): Property ID

**Example:**
```javascript
{
  "id": "prop-123"
}
```

### `lodgify.list_property_rooms`
List all rooms for a specific property.

**Parameters:**
- `propertyId` (required): Property ID

**Example:**
```javascript
{
  "propertyId": "prop-123"
}
```

### `lodgify.list_deleted_properties`
List properties that have been deleted.

**Parameters:**
- `params` (optional): Query parameters for filtering

**Example:**
```javascript
{
  "params": {
    "page": 1,
    "limit": 10
  }
}
```

## Booking Management

### `lodgify.list_bookings`
List all bookings with comprehensive filtering options.

**Parameters:**
- `params` (optional): Query parameters for filtering
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `status`: Booking status
  - `propertyId`: Property ID

**Example:**
```javascript
{
  "params": {
    "from": "2025-11-01",
    "to": "2025-11-30",
    "status": "confirmed"
  }
}
```

### `lodgify.get_booking`
Get detailed information about a specific booking.

**Parameters:**
- `id` (required): Booking ID

**Example:**
```javascript
{
  "id": "book-456"
}
```

### `lodgify.get_booking_payment_link`
Get existing payment link for a booking.

**Parameters:**
- `id` (required): Booking ID

**Example:**
```javascript
{
  "id": "book-456"
}
```

### `lodgify.create_booking_payment_link`
Create a new payment link for a booking.

**Parameters:**
- `id` (required): Booking ID
- `payload` (required): Payment link configuration
  - `amount`: Payment amount (optional)
  - `currency`: Currency code (optional)
  - `description`: Payment description (optional)

**Example:**
```javascript
{
  "id": "book-456",
  "payload": {
    "amount": 1000,
    "currency": "USD",
    "description": "Final payment for booking"
  }
}
```

### `lodgify.update_key_codes`
Update access key codes for a booking.

**Parameters:**
- `id` (required): Booking ID
- `payload` (required): Key codes data
  - `keyCodes`: Array of access codes/keys

**Example:**
```javascript
{
  "id": "book-456",
  "payload": {
    "keyCodes": ["4567", "ABCD"]
  }
}
```

## Rates & Pricing

### `lodgify.daily_rates`
Get daily pricing calendar for properties.

**Parameters:**
- `params` (required): Query parameters
  - `propertyId`: Property ID
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `roomTypeId`: Room type ID (optional)
  - `currency`: Currency code (optional)

**Example:**
```javascript
{
  "params": {
    "propertyId": "prop-123",
    "from": "2025-12-01",
    "to": "2025-12-31"
  }
}
```

### `lodgify.rate_settings`
Get rate configuration settings.

**Parameters:**
- `params` (required): Query parameters
  - `propertyId`: Property ID (optional)
  - `currency`: Currency code (optional)

**Example:**
```javascript
{
  "params": {
    "propertyId": "prop-123"
  }
}
```

## Quotes & Messaging

### `lodgify.get_quote`
Generate detailed pricing quotes for property bookings.

**Parameters:**
- `propertyId` (required): Property ID
- `params` (required): Quote parameters
  - `from`: Check-in date (YYYY-MM-DD)
  - `to`: Check-out date (YYYY-MM-DD)
  - `roomTypes[0].Id`: Room type ID (bracket notation)
  - `guest_breakdown[adults]`: Number of adults (bracket notation)
  - `guest_breakdown[children]`: Number of children (bracket notation, optional)

**Example:**
```javascript
{
  "propertyId": "prop-123",
  "params": {
    "from": "2025-11-20",
    "to": "2025-11-25",
    "roomTypes[0].Id": 999,
    "guest_breakdown[adults]": 2,
    "guest_breakdown[children]": 1
  }
}
```

### `lodgify.get_thread`
Retrieve messaging conversation thread.

**Parameters:**
- `threadGuid` (required): Thread GUID

**Example:**
```javascript
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Property Discovery & Helper Tools

### `lodgify.find_properties`
Find properties in the system when you don't know the exact property ID.

**Parameters:**
- `searchTerm` (optional): Search term to filter properties by name
- `includePropertyIds` (optional): Include property IDs found in recent bookings
- `limit` (optional): Maximum number of properties to return

**Example:**
```javascript
{
  "searchTerm": "beach",
  "includePropertyIds": true,
  "limit": 5
}
```

### `lodgify.check_next_availability`
Find the next available date for a property.

**Parameters:**
- `propertyId` (required): Property ID
- `fromDate` (optional): Start date to check from (YYYY-MM-DD)
- `daysToCheck` (optional): Number of days to check ahead (1-365)

**Example:**
```javascript
{
  "propertyId": "prop-123",
  "fromDate": "2025-11-20",
  "daysToCheck": 90
}
```

### `lodgify.check_date_range_availability`
Verify if a specific date range is available for booking.

**Parameters:**
- `propertyId` (required): Property ID
- `checkInDate` (required): Desired check-in date (YYYY-MM-DD)
- `checkOutDate` (required): Desired check-out date (YYYY-MM-DD)

**Example:**
```javascript
{
  "propertyId": "prop-123",
  "checkInDate": "2025-12-20",
  "checkOutDate": "2025-12-27"
}
```

### `lodgify.get_availability_calendar`
Get a visual calendar view of property availability.

**Parameters:**
- `propertyId` (required): Property ID
- `fromDate` (optional): Calendar start date (YYYY-MM-DD)
- `daysToShow` (optional): Number of days to display (1-90)

**Example:**
```javascript
{
  "propertyId": "prop-123",
  "fromDate": "2025-12-01",
  "daysToShow": 30
}
```

## Resources

### `lodgify://health`
Health check resource providing server status information.

**Response includes:**
- `ok`: Health status (boolean)
- `baseUrl`: API base URL
- `version`: Server version
- `apiKeyConfigured`: API key status
- `timestamp`: Check timestamp

## Complex Parameter Handling

The Lodgify API supports bracket notation for complex nested parameters:

```javascript
// Example: Complex room and guest parameters
params = {
  "roomTypes[0].Id": 123,
  "roomTypes[1].Id": 456,
  "guest_breakdown[adults]": 2,
  "guest_breakdown[children]": 1,
  "guest_breakdown[infants]": 0
}
```

## Error Handling

All tools return structured error responses with:
- HTTP status codes
- Error messages
- Request context
- Detailed error information when available

## Rate Limiting

The server automatically handles Lodgify's rate limits with:
- Exponential backoff retry logic
- Respect for `Retry-After` headers
- Maximum 5 retry attempts
- Backoff up to 30 seconds

## Authentication

All requests require a valid Lodgify API key configured via the `LODGIFY_API_KEY` environment variable.