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

### `lodgify.update_property_availability`
Update availability settings for a property.

**Parameters:**
- `propertyId` (required): Property ID
- `payload` (required): Availability update details
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `available`: Availability status (boolean)
  - `minStay`: Minimum stay requirement (optional)
  - `maxStay`: Maximum stay limit (optional)

**Example:**
```javascript
{
  "propertyId": "prop-123",
  "payload": {
    "from": "2025-12-20",
    "to": "2025-12-31",
    "available": false,
    "minStay": 3
  }
}
```

## Booking Management

### `lodgify.list_bookings`
List bookings with optional filtering by date range, status, etc.

**Parameters:**
- `params` (optional): Query parameters
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `status`: Booking status filter

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
Get details of a specific booking.

**Parameters:**
- `id` (required): Booking ID

### `lodgify.get_booking_payment_link`
Retrieve the payment link for a booking.

**Parameters:**
- `id` (required): Booking ID

### `lodgify.create_booking_payment_link`
Create a new payment link for a booking.

**Parameters:**
- `id` (required): Booking ID
- `payload` (required): Payment link details
  - `amount`: Payment amount
  - `currency`: Currency code

**Example:**
```javascript
{
  "id": "book-456",
  "payload": {
    "amount": 1000,
    "currency": "USD"
  }
}
```

### `lodgify.update_key_codes`
Update key codes for a booking (for smart locks).

**Parameters:**
- `id` (required): Booking ID
- `payload` (required): Key codes data

### `lodgify.create_booking`
Create a new booking in the system.

**Parameters:**
- `payload` (required): Booking details
  - `propertyId`: Property ID
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `guestBreakdown`: Guest breakdown object
    - `adults`: Number of adults (required)
    - `children`: Number of children (optional)
    - `infants`: Number of infants (optional)
  - `roomTypes`: Array of room type objects
    - `id`: Room type ID
    - `quantity`: Number of rooms (optional)

**Example:**
```javascript
{
  "payload": {
    "propertyId": "prop-123",
    "from": "2025-12-01",
    "to": "2025-12-07",
    "guestBreakdown": {
      "adults": 2,
      "children": 1
    },
    "roomTypes": [
      {
        "id": "room-456",
        "quantity": 1
      }
    ]
  }
}
```

### `lodgify.update_booking`
Update an existing booking.

**Parameters:**
- `id` (required): Booking ID
- `payload` (required): Updated booking details
  - `status`: Booking status (optional)
  - `from`: New start date (optional)
  - `to`: New end date (optional)
  - `guestBreakdown`: Updated guest breakdown (optional)

**Example:**
```javascript
{
  "id": "book-789",
  "payload": {
    "status": "confirmed",
    "guestBreakdown": {
      "adults": 3,
      "children": 0
    }
  }
}
```

### `lodgify.delete_booking`
Delete or cancel a booking.

**Parameters:**
- `id` (required): Booking ID

**Example:**
```javascript
{
  "id": "book-789"
}
```

## Availability & Rates

### ✨ **Recommended Availability Tools**

### `lodgify.check_next_availability`
**Best for: "When is this property next available?"**

Find the next available date for a property by analyzing bookings.

**Parameters:**
- `propertyId` (required): Property ID
- `fromDate` (optional): Start date to check from (YYYY-MM-DD, defaults to today)
- `daysToCheck` (optional): Number of days to check ahead (1-365, defaults to 90)

**Example:**
```javascript
{
  "propertyId": "435707",
  "fromDate": "2025-08-14",
  "daysToCheck": 30
}
```

**Response:**
```json
{
  "nextAvailableDate": "2025-08-19",
  "availableUntil": "2025-09-13", 
  "blockedPeriods": [
    {
      "arrival": "2025-08-16",
      "departure": "2025-08-18",
      "status": "Booked",
      "isBlocked": true
    }
  ],
  "totalDaysAvailable": 25,
  "message": "Available from 2025-08-19 to 2025-09-13 (25 days)"
}
```

### `lodgify.check_date_range_availability`
**Best for: "Are these specific dates available?"**

Check if a specific date range is available for booking.

**Parameters:**
- `propertyId` (required): Property ID
- `checkInDate` (required): Check-in date (YYYY-MM-DD)
- `checkOutDate` (required): Check-out date (YYYY-MM-DD)

**Example:**
```javascript
{
  "propertyId": "435707",
  "checkInDate": "2025-08-20",
  "checkOutDate": "2025-08-25"
}
```

**Response:**
```json
{
  "isAvailable": true,
  "conflictingBookings": [],
  "message": "Available for 5 nights from 2025-08-20 to 2025-08-25"
}
```

### `lodgify.get_availability_calendar`
**Best for: "Show me a calendar view of availability"**

Get a calendar view showing available and blocked dates.

**Parameters:**
- `propertyId` (required): Property ID
- `fromDate` (optional): Start date (YYYY-MM-DD, defaults to today)
- `daysToShow` (optional): Number of days to show (1-90, defaults to 30)

**Example:**
```javascript
{
  "propertyId": "435707",
  "fromDate": "2025-08-14",
  "daysToShow": 14
}
```

**Response:**
```json
{
  "calendar": [
    {
      "date": "2025-08-14",
      "isAvailable": false,
      "bookingStatus": "Tentative",
      "isToday": true
    },
    {
      "date": "2025-08-15",
      "isAvailable": true,
      "isToday": false
    }
  ],
  "summary": {
    "totalDays": 14,
    "availableDays": 10,
    "blockedDays": 4,
    "availabilityRate": 71
  }
}
```

### **Raw API Availability Tools**

### `lodgify.availability_property`
Get raw availability data for an entire property (advanced use).

**Parameters:**
- `propertyId` (required): Property ID
- `params` (optional): Query parameters
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)

**Note:** Returns technical availability data. For easier availability checking, use the recommended tools above.

### `lodgify.availability_room`
Get raw availability data for a specific room type (advanced use).

**Parameters:**
- `propertyId` (required): Property ID
- `roomTypeId` (required): Room Type ID
- `params` (optional): Query parameters
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)

**Note:** Returns technical availability data. For easier availability checking, use the recommended tools above.

### `lodgify.daily_rates`
Get daily rates calendar for a property.

**Parameters:**
- `params` (required): Query parameters
  - `propertyId`: Property ID
  - `from`: Start date
  - `to`: End date

### `lodgify.rate_settings`
Get rate configuration settings.

**Parameters:**
- `params` (required): Query parameters
  - `propertyId`: Property ID

### `lodgify.create_rate`
Create or update rates for a property.

**Parameters:**
- `payload` (required): Rate details
  - `propertyId`: Property ID
  - `roomTypeId`: Room type ID
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `rate`: Rate amount (positive number)
  - `currency`: Currency code (optional, 3 characters)

**Example:**
```javascript
{
  "payload": {
    "propertyId": "prop-123",
    "roomTypeId": "room-456",
    "from": "2025-12-01",
    "to": "2025-12-31",
    "rate": 150.00,
    "currency": "USD"
  }
}
```

### `lodgify.update_rate`
Update a specific rate.

**Parameters:**
- `id` (required): Rate ID
- `payload` (required): Updated rate details
  - `rate`: New rate amount (optional)
  - `currency`: Currency code (optional)
  - `from`: New start date (optional)
  - `to`: New end date (optional)

**Example:**
```javascript
{
  "id": "rate-789",
  "payload": {
    "rate": 175.00,
    "currency": "EUR"
  }
}
```

## Quotes & Messaging

### `lodgify.get_quote`
Generate a quote for a property stay with complex parameters.

**Parameters:**
- `propertyId` (required): Property ID
- `params` (required): Quote parameters

**Example with bracket notation:**
```javascript
{
  "propertyId": "prop-123",
  "params": {
    "from": "2025-11-20",
    "to": "2025-11-25",
    "roomTypes[0].Id": 999,
    "roomTypes[0].quantity": 1,
    "guest_breakdown[adults]": 2,
    "guest_breakdown[children]": 0,
    "currency": "USD"
  }
}
```

### `lodgify.get_thread`
Retrieve a messaging thread.

**Parameters:**
- `threadGuid` (required): Thread GUID

## Webhook Management

### `lodgify.subscribe_webhook`
Subscribe to a webhook event to receive notifications.

**Parameters:**
- `payload` (required): Webhook subscription details
  - `event`: Event name to subscribe to
  - `targetUrl`: URL where webhook notifications will be sent

**Example:**
```javascript
{
  "payload": {
    "event": "booking.created",
    "targetUrl": "https://your-app.com/webhooks/lodgify"
  }
}
```

### `lodgify.list_webhooks`
List all active webhook subscriptions.

**Parameters:**
- `params` (optional): Query parameters for filtering
  - `page`: Page number
  - `limit`: Results per page

**Example:**
```javascript
{
  "params": {
    "page": 1,
    "limit": 10
  }
}
```

### `lodgify.delete_webhook`
Unsubscribe from a webhook event.

**Parameters:**
- `id` (required): Webhook ID

**Example:**
```javascript
{
  "id": "webhook-123"
}
```

## Health Check

The server provides a health check resource:
- **URI**: `lodgify://health`
- **Returns**: Server status, API configuration, and version info

## Complex Parameter Support

The server supports Lodgify's bracket notation for complex nested parameters:

```javascript
// Nested objects are automatically flattened:
{
  "guest_breakdown": {
    "adults": 2,
    "children": 1
  }
}
// Becomes: guest_breakdown[adults]=2&guest_breakdown[children]=1

// Arrays with objects:
{
  "roomTypes": [
    { "Id": 123, "quantity": 1 }
  ]
}
// Becomes: roomTypes[0][Id]=123&roomTypes[0][quantity]=1

// Pre-bracketed keys are preserved:
{
  "filters[type]": "VILLA",
  "filters[amenities][0]": "POOL"
}
```