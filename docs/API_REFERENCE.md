# API Reference

Complete reference for all Lodgify MCP Server tools with detailed parameters, examples, and usage patterns.

## Overview

The Lodgify MCP Server exposes 20+ tools organized into logical categories. Each tool corresponds to specific Lodgify API endpoints and provides structured data that AI assistants can interpret and present.

## Tool Categories

- [Property Management](#property-management) - Property discovery, details, and room information
- [Booking Management](#booking-management) - Reservations, payments, and guest management
- [Availability & Calendar](#availability--calendar) - Date availability and calendar views
- [Rates & Pricing](#rates--pricing) - Daily rates, quotes, and pricing configuration
- [Webhooks & Notifications](#webhooks--notifications) - Event subscriptions and messaging
- [Resources](#resources) - Health checks and system monitoring

## Property Management

### `lodgify_list_properties`

List all properties with optional filtering and pagination.

**Parameters:**
- `wid` (number, optional) - Website ID
- `updatedSince` (string, optional) - ISO datetime, return only properties modified since this date
- `includeCount` (boolean, optional) - Return total count of results
- `includeInOut` (boolean, optional) - Include available dates for arrival/departure
- `page` (number, optional) - Page number (default: 1)
- `size` (number, optional) - Items per page, max 50 (default: 50)

**Example Usage:**
```
"List all my properties"
"Show me properties updated in the last week"
"Get the first 10 properties with availability info"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": 123,
      "name": "Ocean View Villa",
      "location": "Miami Beach, FL",
      "status": "active",
      "rooms": 3,
      "currency": "USD"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "size": 10
  }
}
```

### `lodgify_get_property`

Retrieve comprehensive details for a specific property.

**Parameters:**
- `id` (number, required) - Property ID
- `wid` (number, optional) - Website ID
- `includeInOut` (boolean, optional) - Include available arrival/departure dates

**Example Usage:**
```
"Get details about property 123"
"Show me all information for Ocean View Villa"
"What are the details of my beachfront property?"
```

**Example Response:**
```json
{
  "id": 123,
  "name": "Ocean View Villa",
  "description": "Luxury beachfront villa with stunning ocean views",
  "location": {
    "address": "123 Ocean Drive",
    "city": "Miami Beach",
    "state": "FL",
    "country": "USA",
    "zipCode": "33139"
  },
  "amenities": ["WiFi", "Pool", "Beach Access", "Parking"],
  "roomTypes": [
    {
      "id": 456,
      "name": "Master Suite",
      "maxOccupancy": 2,
      "beds": 1
    }
  ],
  "currency": "USD",
  "checkInTime": "15:00",
  "checkOutTime": "11:00"
}
```

### `lodgify_list_property_rooms`

Retrieve all room types and configurations for a specific property.

**Parameters:**
- `propertyId` (string, required) - Property ID

**Example Usage:**
```
"Show me all room types for property 123"
"What rooms are available in Ocean View Villa?"
"List the accommodation options for my beach house"
```

### `lodgify_find_properties`

Find properties when you don't know the exact property ID. Searches by name and gets property IDs from recent bookings.

**Parameters:**
- `searchTerm` (string, optional) - Property name search term (case-insensitive)
- `includePropertyIds` (boolean, optional) - Include property IDs from bookings (default: true)
- `limit` (number, optional) - Maximum results (default: 10, max: 50)

**Example Usage:**
```
"Find properties with 'beach' in the name"
"Search for villa properties"
"Show me all properties that have recent bookings"
```

### `lodgify_list_deleted_properties`

Retrieve properties that have been soft-deleted for auditing and recovery.

**Parameters:**
- `params.deletedSince` (string, optional) - ISO datetime, filter properties deleted after this date

**Example Usage:**
```
"Show me any deleted properties"
"List properties deleted in the last month"
"What properties have been removed from my account?"
```

## Booking Management

### `lodgify_list_bookings`

Retrieve all bookings with comprehensive filtering options.

**Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `size` (number, optional) - Items per page, max 50 (default: 50)
- `includeCount` (boolean, optional) - Include total count
- `includeTransactions` (boolean, optional) - Include payment details
- `includeQuoteDetails` (boolean, optional) - Include pricing breakdown
- `includeExternal` (boolean, optional) - Include external bookings
- `stayFilter` (string, optional) - Filter by stay dates:
  - `Upcoming` - Future bookings
  - `Current` - Active bookings
  - `Historic` - Past bookings
  - `All` - All bookings
  - `ArrivalDate` - Specific arrival date (requires `stayFilterDate`)
  - `DepartureDate` - Specific departure date (requires `stayFilterDate`)
- `stayFilterDate` (string, optional) - ISO datetime for arrival/departure filtering
- `updatedSince` (string, optional) - ISO datetime, only bookings updated since this date
- `trash` (string, optional) - Include trashed bookings: `False`, `True`, `All`

**Example Usage:**
```
"Show me all upcoming bookings"
"List bookings arriving today"
"Get all bookings for November with payment details"
"Show me cancelled bookings"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "BK001",
      "status": "confirmed",
      "propertyId": 123,
      "propertyName": "Ocean View Villa",
      "checkIn": "2024-03-15",
      "checkOut": "2024-03-22",
      "guests": {
        "adults": 2,
        "children": 0
      },
      "guest": {
        "name": "John Smith",
        "email": "john@example.com",
        "phone": "+1234567890"
      },
      "totalAmount": 1750.00,
      "currency": "USD",
      "paymentStatus": "paid"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 0
  }
}
```

### `lodgify_get_booking`

Retrieve complete details for a specific booking.

**Parameters:**
- `id` (string, required) - Booking/reservation ID

**Example Usage:**
```
"Get details for booking BK-2024-001"
"Show me complete information for the Smith family booking"
"What are the details of reservation BK001?"
```

### `lodgify_get_booking_payment_link`

Retrieve existing payment link for a booking.

**Parameters:**
- `id` (string, required) - Booking ID

**Example Usage:**
```
"Get the payment link for booking BK001"
"Show me payment details for the Wilson booking"
"Is there a payment link for reservation BK-2024-001?"
```

### `lodgify_create_booking_payment_link`

Generate a secure payment link for outstanding booking balances.

**Parameters:**
- `id` (string, required) - Booking ID
- `payload.amount` (number, optional) - Payment amount (defaults to booking balance)
- `payload.currency` (string, optional) - Currency code (e.g., USD, EUR)
- `payload.description` (string, optional) - Payment description for guest

**Example Usage:**
```
"Create a payment link for booking BK001"
"Generate a $500 payment link for the Smith booking"
"Create a payment link for the final balance of reservation BK-2024-001"
```

### `lodgify_update_key_codes`

Update access key codes for property entry systems.

**Parameters:**
- `id` (number, required) - Booking ID
- `payload.keyCodes` (array, required) - Array of access codes/keys

**Example Usage:**
```
"Update the key code for booking 123 to '4567'"
"Set access codes ['1234', '5678'] for the Wilson booking"
"Change the door code for reservation BK001 to 'SUMMER2024'"
```

### `lodgify_checkin_booking`

Mark a booking as checked in.

**Parameters:**
- `id` (number, required) - Booking ID  
- `time` (string, required) - Check-in time in ISO 8601 format

**Example Usage:**
```
"Check in booking 123 at 3:00 PM today"
"Mark the Smith family as checked in now"
"Record check-in for reservation BK001"
```

### `lodgify_checkout_booking`

Mark a booking as checked out.

**Parameters:**
- `id` (number, required) - Booking ID
- `time` (string, required) - Check-out time in ISO 8601 format  

**Example Usage:**
```
"Check out booking 123 at 11:00 AM"
"Mark the Wilson family as checked out"
"Record departure for reservation BK001"
```

### Booking Creation & Management (v1 API)

The server also includes v1 API tools for creating, updating, and deleting bookings:

#### `lodgify_create_booking`

Create a new booking with automatic data transformation.

**Required Parameters:**
- `property_id` (number) - Property ID
- `room_type_id` (number) - Room type ID  
- `arrival` (string) - Check-in date (YYYY-MM-DD)
- `departure` (string) - Check-out date (YYYY-MM-DD)
- `guest_name` (string) - Primary guest name
- `adults` (number) - Number of adults (minimum 1)

**Optional Parameters:**
- `guest_email` (string) - Guest email
- `guest_phone` (string) - Guest phone
- `children` (number) - Number of children
- `status` (string) - Booking status: booked, tentative, declined, confirmed
- `source` (string) - Booking source/channel
- `notes` (string) - Special requests or notes

#### `lodgify_update_booking` 

Update an existing booking's details.

#### `lodgify_delete_booking`

Permanently delete a booking (use with caution).

## Availability & Calendar

### `lodgify_check_next_availability`

Find the next available date range for a property.

**Parameters:**
- `propertyId` (string, required) - Property ID
- `fromDate` (string, optional) - Start date (YYYY-MM-DD), defaults to today
- `daysToCheck` (number, optional) - Days to check ahead (1-365, default: 90)

**Example Usage:**
```
"When is Ocean View Villa next available?"
"Find the next opening for property 123"
"Check availability for my beach house starting next week"
```

**Example Response:**
```json
{
  "propertyId": 123,
  "nextAvailableDate": "2024-03-22",
  "availableDays": 7,
  "availableUntil": "2024-03-29",
  "message": "Next available from 2024-03-22 for 7 days",
  "recommendations": [
    "Check availability calendar for detailed daily status",
    "Consider checking different room types if property is fully booked"
  ]
}
```

### `lodgify_check_date_range_availability`

Verify if specific dates are available for booking.

**Parameters:**
- `propertyId` (string, required) - Property ID
- `checkInDate` (string, required) - Desired check-in date (YYYY-MM-DD)
- `checkOutDate` (string, required) - Desired check-out date (YYYY-MM-DD)

**Example Usage:**
```
"Is Ocean View Villa available December 20-27?"
"Check if property 123 is free for Christmas week"
"Verify availability for March 15-22 at my beach house"
```

### `lodgify_get_availability_calendar`

Get a visual calendar view of property availability.

**Parameters:**
- `propertyId` (string, required) - Property ID
- `fromDate` (string, optional) - Calendar start date (YYYY-MM-DD), defaults to today
- `daysToShow` (number, optional) - Days to display (1-90, default: 30)

**Example Usage:**
```
"Show me a calendar view for Ocean View Villa for the next month"
"Display availability calendar for property 123 starting December 1st"
"Get a 60-day calendar view for my beachfront property"
```

## Rates & Pricing

### `lodgify_daily_rates`

View daily pricing rates across date ranges.

**Parameters:**
- `roomTypeId` (number, required) - Room type ID
- `houseId` (number, required) - House/Property ID  
- `startDate` (string, required) - Start date (YYYY-MM-DD)
- `endDate` (string, required) - End date (YYYY-MM-DD)

**Example Usage:**
```
"Show me daily rates for Ocean View Villa in December"
"Get pricing for room type 456 from Dec 20-30"
"What are the rates for my penthouse suite for New Year's week?"
```

### `lodgify_rate_settings`

Retrieve rate configuration and pricing rules.

**Parameters:**
- `params.houseId` (number, optional) - House/Property ID

**Example Usage:**
```
"Show me rate settings for property 123"
"What are the pricing rules for Ocean View Villa?"
"Get rate configuration for all my properties"
```

### `lodgify_get_quote`

Generate detailed pricing quotes for bookings.

**Parameters:**
- `propertyId` (string, required) - Property ID
- `params` (object, required) - Quote parameters using bracket notation:
  - `from` (string) - Start date (YYYY-MM-DD)  
  - `to` (string) - End date (YYYY-MM-DD)
  - `guest_breakdown[adults]` (number) - Number of adults
  - `guest_breakdown[children]` (number) - Number of children
  - `roomTypes[0].Id` (number) - Room type ID

**Example Usage:**
```
"Get a quote for Ocean View Villa from Dec 20-27 for 2 adults"
"Calculate pricing for property 123, 4 adults, 5 nights"
"Quote me for the penthouse suite next week for 2 adults and 1 child"
```

### `lodgify_update_rates`

Update property rates for specific date ranges (v1 API).

**Parameters:**
- `property_id` (number, required) - Property ID
- `rates` (array, required) - Array of rate updates with:
  - `room_type_id` (number) - Room type ID
  - `start_date` (string) - Start date (YYYY-MM-DD) 
  - `end_date` (string) - End date (YYYY-MM-DD)
  - `price_per_day` (number) - Daily rate
  - `min_stay` (number, optional) - Minimum stay requirement
  - `currency` (string, optional) - Currency code

**Example Usage:**
```
"Update rates for property 123, room 456 to $200/night from Dec 23-30"
"Set pricing for my villa to $350/night for all of December"
"Change rates for the penthouse to $500/night for New Year's week"
```

## Webhooks & Notifications

### `lodgify_list_webhooks`

List all webhook subscriptions configured for the account.

**Example Usage:**
```
"Show me all webhook subscriptions"
"List my event notifications"
"What webhooks are configured?"
```

### `lodgify_subscribe_webhook`

Subscribe to webhook events for real-time notifications.

**Parameters:**
- `event` (string, required) - Event type to subscribe to:
  - `rate_change` - Rate or pricing changes
  - `availability_change` - Availability updates  
  - `booking_new_any_status` - Any new booking
  - `booking_new_status_booked` - New confirmed bookings
  - `booking_change` - Any booking modification
  - `booking_status_change_booked` - Status changed to booked
  - `booking_status_change_tentative` - Status changed to tentative
  - `booking_status_change_open` - Status changed to open
  - `booking_status_change_declined` - Status changed to declined
  - `guest_message_received` - New guest message
- `target_url` (string, required) - HTTPS URL endpoint for notifications

**Example Usage:**
```
"Subscribe to new booking notifications at https://my-app.com/webhooks"
"Set up webhook for rate changes to my endpoint"
"Create notification for guest messages to my system"
```

### `lodgify_unsubscribe_webhook`

Remove a webhook subscription.

**Parameters:**
- `id` (string, required) - Webhook subscription ID

**Example Usage:**
```
"Remove webhook subscription webhook_123"
"Unsubscribe from booking notifications"
"Delete the payment webhook"
```

### `lodgify_get_thread`

Retrieve messaging conversation threads.

**Parameters:**
- `threadGuid` (string, required) - Thread GUID

**Example Usage:**
```
"Get message thread abc-123-def"
"Show me conversation thread for the Smith booking"
"Retrieve guest messages for thread xyz-789"
```

## Resources

### Health Check Resource

#### `lodgify://health`

Monitor server health and API connectivity.

**Example Usage:**
```
"Check if the Lodgify server is healthy"
"Verify API connection status"
"Show me system health information"
```

**Example Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-15T10:30:00Z",
  "version": "1.0.0",
  "api": {
    "status": "connected",
    "responseTime": "150ms"
  }
}
```

## Common Usage Patterns

### Property Discovery Workflow

```
1. "Find properties with 'beach' in the name"
2. "Get details about Ocean View Villa"  
3. "Show me room types for this property"
4. "When is it next available?"
```

### Booking Management Workflow

```
1. "Show me all upcoming bookings"
2. "Get details for booking BK-2024-001"
3. "Create a payment link for this booking"
4. "Update the access code to 4567"
```

### Availability & Pricing Workflow  

```
1. "Is Ocean View Villa available December 20-27?"
2. "Get a quote for 2 adults for those dates"
3. "Show me daily rates for the entire month"
4. "Display a calendar view of availability"
```

### Complex Multi-Step Workflow

```
1. "Find my most popular property"
2. "Check its availability for next month"
3. "If available, show me the rates"  
4. "Create a quote for a 7-day stay for 4 adults"
5. "Set up a webhook for new bookings"
```

## Error Handling

All tools include comprehensive error handling with structured responses:

### Common Error Types

- **Validation Errors**: Invalid parameters or missing required fields
- **Authentication Errors**: Invalid API key or expired credentials  
- **Rate Limiting**: Too many requests, automatic retry with backoff
- **Not Found**: Property, booking, or resource doesn't exist
- **Server Errors**: Lodgify API unavailable or internal errors

### Error Response Format

```json
{
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "details": "Property ID must be a valid number",
      "field": "propertyId"
    }
  }
}
```

## Rate Limiting & Performance

The server automatically handles:

- **Rate Limiting**: Detects 429 responses and retries with exponential backoff
- **Connection Pooling**: Reuses HTTP connections for better performance
- **Request Compression**: Reduces bandwidth usage
- **Automatic Retries**: Up to 5 attempts with smart backoff strategy

## Best Practices

### Efficient Property Discovery

1. Use `lodgify_find_properties` when you don't know property IDs
2. Cache property details to avoid repeated API calls
3. Use specific search terms to reduce result sets

### Booking Management

1. Always check availability before creating bookings
2. Use read-only mode in development to prevent accidental changes
3. Filter bookings by status and date ranges to reduce response sizes

### Rate Management

1. Check current rates before updating to avoid conflicts
2. Use date ranges efficiently to minimize API calls
3. Cache rate settings for frequently accessed properties

### Error Recovery

1. Handle validation errors by correcting parameters
2. Implement retry logic for temporary failures
3. Use health check resource to monitor API connectivity
4. Log errors with context for debugging

## Support Resources

- **Tool Catalog**: Complete parameter reference
- **Error Handling Guide**: Detailed error codes and recovery strategies  
- **Security Documentation**: API key management and best practices
- **Troubleshooting Guide**: Common issues and solutions
- **GitHub Issues**: Report bugs and request features
- **Lodgify API Documentation**: Official API reference