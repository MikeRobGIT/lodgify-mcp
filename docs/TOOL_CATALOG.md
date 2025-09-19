# Lodgify MCP Tool Catalog

Complete reference for all available Lodgify MCP tools and their parameters.

## Property Management

### `lodgify_list_properties`

List all properties with optional filtering and pagination.

**Parameters:**

- `wid` (optional, number): Website ID
- `updatedSince` (optional, string): Return only properties modified since this datetime (ISO 8601)
- `includeCount` (optional, boolean): Return the total number of results (default: false)
- `includeInOut` (optional, boolean): Include available dates for arrival or departure (default: false)
- `page` (optional, number): Page number to retrieve (default: 1)
- `size` (optional, number): Number of items per page (max 50, default: 50)

**Example:**

```javascript
{
  "wid": 12345,
  "updatedSince": "2024-01-01T00:00:00Z",
  "includeCount": true,
  "includeInOut": false,
  "page": 1,
  "size": 10
}
```

### `lodgify_get_property`

Get detailed information about a specific property.

**Parameters:**

- `id` (required, number): Property ID
- `wid` (optional, number): Website ID
- `includeInOut` (optional, boolean): Include available dates for arrival or departure (default: false)

**Example:**

```javascript
{
  "id": 123,
  "includeInOut": true
}
```

### `lodgify_list_property_rooms`

List all rooms for a specific property.

**Parameters:**

- `propertyId` (required, string): Property ID to list room types for

**Example:**

```javascript
{
  "propertyId": "684855"
}
```

### `lodgify_list_deleted_properties`

List properties that have been deleted.

**Parameters:**

- `params` (optional, object): Query parameters for filtering
  - `deletedSince` (optional, string): Filter properties deleted after this date (ISO 8601)

**Example:**

```javascript
{
  "params": {
    "deletedSince": "2024-01-01T00:00:00Z"
  }
}
```

## Booking & Reservation Management

### `lodgify_list_bookings`

List bookings with comprehensive filtering options. Maximum page size is 50 items per request. Default stay filter is "Upcoming" for performance and relevance. Avoid using "All" as it can return a very large dataset.

**Parameters:**

- `page` (optional, number): Page number to retrieve (default: 1)
- `size` (optional, number): Number of items per page (max: 50, default: 50)
- `includeCount` (optional, boolean): Include total number of results (default: false)
- `includeExternal` (optional, boolean): Include external bookings (default: false)
- `includeQuoteDetails` (optional, boolean): Include quote details (default: false)
- `includeTransactions` (optional, boolean): Include details about transactions and schedule (default: false)
- `stayFilter` (optional, string): Filter bookings by stay dates (Upcoming, Current, Historic, All, ArrivalDate, DepartureDate). Prefer `Upcoming`; avoid `All` unless absolutely necessary. (default: `Upcoming`)
- `stayFilterDate` (optional, string): Date (YYYY-MM-DD) required when using `ArrivalDate` or `DepartureDate` in `stayFilter`
- `updatedSince` (optional, string): Include only bookings updated since this date (ISO 8601)
- `trash` (optional, string): Query bookings that are in trash (enum: False, True, All)

**Example:**

```javascript
{
  "page": 1,
  "size": 10,
  "includeCount": true,
  "stayFilter": "Upcoming",
  "updatedSince": "2024-03-01T00:00:00Z"
}
```

### `lodgify_get_booking`

Get detailed information about a specific booking.

**Parameters:**

- `id` (required, string): Unique booking/reservation ID to retrieve

**Example:**

```javascript
{
  "id": "BK001"
}
```

### `lodgify_get_booking_payment_link`

Get existing payment link for a booking including payment status, amount due, and link expiration.

**Parameters:**

- `id` (required, string): Booking ID to get payment link for

**Example:**

```javascript
{
  "id": "book-456"
}
```

### `lodgify_create_booking_payment_link`

Generate a secure payment link for a booking allowing guests to pay outstanding balances online.

**Parameters:**

- `id` (required, string): Booking ID to create payment link for
- `payload` (required, object): Payment link configuration
  - `amount` (optional, number): Payment amount (defaults to booking balance)
  - `currency` (optional, string): Currency code (e.g., USD, EUR)
  - `description` (optional, string): Payment description for guest (max 500 chars)

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

### `lodgify_update_key_codes`

Update access key codes for a booking to provide guests with property entry information.

**Parameters:**

- `id` (required, number): Booking ID to update key codes for
- `payload` (required, object): Access key codes and entry information
  - `keyCodes` (required, string[]): Array of access codes/keys for the property

**Example:**

```javascript
{
  "id": 456,
  "payload": {
    "keyCodes": ["4567", "ABCD"]
  }
}
```

### `lodgify_checkin_booking`

Mark a booking as checked in. Updates the booking status to reflect that the guest has arrived.

**Parameters:**

- `id` (required, number): Booking ID to check in
- `time` (required, string): Check-in time in ISO 8601 date-time format

**Example:**

```javascript
{
  "id": 456,
  "time": "2024-03-15T15:00:00Z"
}
```

### `lodgify_checkout_booking`

Mark a booking as checked out. Updates the booking status to reflect that the guest has departed.

**Parameters:**

- `id` (required, number): Booking ID to check out
- `time` (required, string): Check-out time in ISO 8601 date-time format

**Example:**

```javascript
{
  "id": 456,
  "time": "2024-03-22T11:00:00Z"
}
```

### `lodgify_get_external_bookings`

Retrieve external bookings associated with a property. These are bookings made through external channels (OTAs).

**Parameters:**

- `id` (required, string): Property ID to get external bookings for

**Example:**

```javascript
{
  "id": "684855"
}
```

### `lodgify_create_booking`

Create a new booking in the system. This v1 endpoint provides direct booking creation functionality.

**Parameters:**

- `property_id` (required, number): Property ID for the booking
- `room_type_id` (required, number): Room type ID
- `arrival` (required, string): Arrival date (YYYY-MM-DD)
- `departure` (required, string): Departure date (YYYY-MM-DD)
- `guest_name` (required, string): Primary guest name
- `adults` (required, number): Number of adult guests (minimum 1)
- `guest_email` (optional, string): Guest email address
- `guest_phone` (optional, string): Guest phone number
- `children` (optional, number): Number of children (default: 0)
- `infants` (optional, number): Number of infants
- `status` (optional, string): Booking status (booked, tentative, declined, confirmed)
- `source` (optional, string): Booking source or channel
- `notes` (optional, string): Internal notes or special requests

**Example:**

```javascript
{
  "property_id": 684855,
  "room_type_id": 751902,
  "arrival": "2025-08-27",
  "departure": "2025-08-28",
  "guest_name": "Test Guest",
  "guest_email": "test@example.com",
  "adults": 2,
  "children": 0,
  "status": "booked",
  "source": "Direct Website"
}
```

### `lodgify_update_booking`

Update an existing booking's details. This v1 endpoint provides comprehensive booking modification capabilities.

**Parameters:**

- `id` (required, number): Booking ID to update
- `arrival` (optional, string): New arrival date (YYYY-MM-DD)
- `departure` (optional, string): New departure date (YYYY-MM-DD)
- `guest_name` (optional, string): Updated guest name
- `guest_email` (optional, string): Updated guest email
- `guest_phone` (optional, string): Updated guest phone
- `adults` (optional, number): Updated number of adults (minimum 1)
- `children` (optional, number): Updated number of children
- `infants` (optional, number): Updated number of infants
- `property_id` (optional, number): New property ID
- `room_type_id` (optional, number): New room type ID
- `status` (optional, string): Updated booking status
- `source` (optional, string): Updated booking source
- `notes` (optional, string): Updated notes

**Example:**

```javascript
{
  "id": 789,
  "arrival": "2024-06-16",
  "departure": "2024-06-21",
  "guest_name": "Updated Guest Name",
  "adults": 3,
  "status": "tentative"
}
```

### `lodgify_delete_booking`

Permanently delete a booking from the system. Use with caution as this action cannot be undone.

**Parameters:**

- `id` (required, number): Booking ID to delete permanently

**Example:**

```javascript
{
  "id": 789
}
```

## Rates & Pricing

### `lodgify_daily_rates`

View daily pricing rates for properties across date ranges. Shows the actual nightly rates that would be charged for specific dates.

**Parameters:**

- `roomTypeId` (required, number): Room Type ID
- `houseId` (required, number): House/Property ID
- `startDate` (required, string): Start date for rates calendar (YYYY-MM-DD)
- `endDate` (required, string): End date for rates calendar (YYYY-MM-DD)

**Example:**

```javascript
{
  "roomTypeId": 123,
  "houseId": 456,
  "startDate": "2024-03-01",
  "endDate": "2024-03-31"
}
```

### `lodgify_rate_settings`

Retrieve rate configuration settings including pricing rules, modifiers, seasonal adjustments, and rate calculation parameters.

**Parameters:**

- `params` (optional, object): Query parameters for rate settings
  - `houseId` (optional, number): Property ID

**Example:**

```javascript
{
  "params": {
    "houseId": 456
  }
}
```

### `lodgify_update_rates`

Update rates for properties and room types. This v1 endpoint provides direct rate modification capability.

**Parameters:**

- `property_id` (required, number): Property ID to update rates for
- `rates` (required, array): Array of rate updates to apply
  - `room_type_id` (required, number): Room type ID
  - `start_date` (required, string): Start date for rate period (YYYY-MM-DD)
  - `end_date` (required, string): End date for rate period (YYYY-MM-DD)
  - `price_per_day` (required, number): Rate amount per day
  - `min_stay` (optional, number): Minimum stay requirement
  - `currency` (optional, string): Currency code (e.g., USD, EUR)

**Example:**

```javascript
{
  "property_id": 123,
  "rates": [
    {
      "room_type_id": 456,
      "start_date": "2024-06-01",
      "end_date": "2024-08-31",
      "price_per_day": 150.00,
      "min_stay": 3,
      "currency": "USD"
    }
  ]
}
```

### `lodgify_create_booking_quote`

Create a custom quote for an existing booking with pricing adjustments. This allows property managers to provide personalized pricing for specific bookings.

**Parameters:**

- `bookingId` (required, string): Booking ID to create quote for
- `payload` (required, object): Quote creation payload with pricing and terms
  - `totalPrice` (optional, number): Total quote amount
  - `currency` (optional, string): Currency code (e.g., USD, EUR)
  - `subtotal` (optional, number): Subtotal before taxes/fees
  - `breakdown` (optional, object): Price breakdown details
    - `accommodation` (optional, number): Accommodation cost
    - `taxes` (optional, number): Tax amount
    - `fees` (optional, number): Service fees
    - `extras` (optional, number): Extra services cost
    - `discount` (optional, number): Discount amount
  - `adjustments` (optional, array): Custom pricing adjustments array
    - `type` (required, string): Type of adjustment (discount, fee, tax, extra)
    - `description` (required, string): Description of adjustment
    - `amount` (required, number): Adjustment amount
    - `isPercentage` (optional, boolean): Is this a percentage?
  - `validUntil` (optional, string): Quote expiration date (ISO 8601)
  - `sendToGuest` (optional, boolean): Send quote to guest via email
  - `replaceExisting` (optional, boolean): Replace existing quote if any
  - `notes` (optional, string): Internal notes about the quote
  - `customTerms` (optional, string): Custom terms and conditions
  - `policyId` (optional, string): Cancellation policy ID
  - `rentalAgreementId` (optional, string): Rental agreement ID

**Example:**

```javascript
{
  "bookingId": "BK12345",
  "payload": {
    "totalPrice": 1500.00,
    "currency": "USD",
    "breakdown": {
      "accommodation": 1200.00,
      "taxes": 150.00,
      "fees": 100.00,
      "discount": 50.00
    },
    "adjustments": [
      {
        "type": "discount",
        "description": "Early booking discount",
        "amount": 50.00,
        "isPercentage": false
      }
    ],
    "validUntil": "2024-03-31T23:59:59Z",
    "notes": "Special rate for returning guest",
    "sendToGuest": true
  }
}
```

## Quotes & Messaging

### `lodgify_get_quote`

Retrieve an existing quote that was created when a booking was made. This does NOT calculate new pricing.

**Parameters:**

- `propertyId` (required, string): Property ID with existing booking/quote
- `params` (required, object): Quote retrieval parameters
  - Dates (from/to) that match the booking (string)
  - Room types (roomTypes[0].Id) (number)
  - Guest breakdown (guest_breakdown[adults]) (number)
  - Uses bracket notation for complex parameters

**Example:**

```javascript
{
  "propertyId": "684855",
  "params": {
    "from": "2025-09-01",
    "to": "2025-09-03",
    "guest_breakdown[adults]": 2
  }
}
```

### `lodgify_get_thread`

Retrieve a messaging conversation thread including all messages, participants, and thread metadata.

**IMPORTANT**: This is currently the ONLY functional messaging endpoint in the Lodgify API v2.

To find thread UIDs:
1. Get a booking using `lodgify_get_booking`
2. Look for the `thread_uid` field in the booking data
3. Use that UUID with this tool to retrieve the conversation

**Parameters:**

- `threadGuid` (required, string): Thread UID from booking data (found in thread_uid field)

**Example:**

```javascript
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Messaging Limitations

**IMPORTANT API LIMITATIONS:**
The Lodgify API has significant limitations for messaging functionality:

1. **v2 API Limitations** (current implementation):
   - Only GET /v2/messaging/{threadGuid} exists
   - Cannot list all threads (endpoint doesn't exist)
   - Cannot send messages (endpoint doesn't exist)
   - Cannot mark threads as read (endpoint doesn't exist)
   - Cannot archive threads (endpoint doesn't exist)

2. **v1 API Issues** (legacy endpoints):
   - POST /v1/reservation/booking/{id}/messages exists but is **NON-FUNCTIONAL**
   - POST /v1/reservation/enquiry/{id}/messages exists but is **NON-FUNCTIONAL**
   - These endpoints return 200 OK but do NOT actually send messages
   - This is a known issue acknowledged by Lodgify support
   - See: https://docs.lodgify.com/discuss/6899e597bd22070fb43002df

**Current Workaround:**
For guest communication, property managers must use:
- The Lodgify web interface or mobile app
- Email communication outside of Lodgify
- Wait for Lodgify to fix their messaging API endpoints

## Property Discovery & Helper Tools

### `lodgify_find_properties`

Find properties in the system when you don't know the exact property ID. Searches properties by name and gets property IDs from bookings.

**Parameters:**

- `searchTerm` (optional, string): Search term to filter properties by name (case-insensitive)
- `includePropertyIds` (optional, boolean): Include property IDs found in recent bookings (default: true)
- `limit` (optional, number): Maximum number of properties to return (default: 10, max: 50)

**Example:**

```javascript
{
  "searchTerm": "beach",
  "includePropertyIds": true,
  "limit": 5
}
```

## Availability & Calendar

### `lodgify_get_property_availability`

Get availability for a specific property over a period. This is the most accurate availability checker that directly queries the property's availability status from the API. Use this for checking before booking or blocking dates.

**Parameters:**

- `propertyId` (required, string): Property ID
- `params` (optional, object): Query parameters
  - `from` (optional, string): Start date (accepts YYYY-MM-DD or ISO 8601 date-time)
  - `to` (optional, string): End date (accepts YYYY-MM-DD or ISO 8601 date-time)

Note: When ISO 8601 date-time values are provided for `from`/`to`, the server normalizes them to `YYYY-MM-DD` for validation and request processing.

**Example:**

```javascript
{
  "propertyId": "123",
  "params": {
    "from": "2024-03-01",
    "to": "2024-03-31"
  }
}
```

### `lodgify_list_vacant_inventory`

List all properties vacant for a date range, optionally including room details. This aggregates availability across properties, so you can find inventory in one call.

**Parameters:**

- `from` (required, string): Start date (YYYY-MM-DD)
- `to` (required, string): End date (YYYY-MM-DD)
- `propertyIds` (optional, array of string/number): Only check these properties
- `includeRooms` (optional, boolean): Include room types per property (default: true)
- `limit` (optional, number): Max properties to check when `propertyIds` not provided (default: 25, max: 200)
- `wid` (optional, number): Optional website ID filter

**How Vacancy is Determined:**

- The tool queries the Lodgify API which returns an array response with availability periods
- Properties are marked as unavailable when the API returns `available: 0` for the requested date range
- When a property is unavailable at the property level, all its rooms are automatically marked as unavailable without additional API calls
- Only rooms in available properties are individually checked for their specific availability

**Example:**

```javascript
{
  "from": "2025-11-20",
  "to": "2025-11-25",
  "includeRooms": true,
  "limit": 25
}
```

## Webhooks & Notifications

### `lodgify_list_webhooks`

List all webhook subscriptions configured for the account. Returns webhook details including event types, target URLs, status, and last triggered timestamps.

**Parameters:**
None

**Example:**

```javascript
{}
```

### `lodgify_subscribe_webhook`

Subscribe to webhook events to receive real-time notifications when specific events occur in Lodgify. Supports various event types including booking changes, rate updates, and guest messages.

**Parameters:**

- `event` (required, string): Event type to subscribe to (rate_change, availability_change, booking_new_any_status, booking_new_status_booked, booking_change, booking_status_change_booked, booking_status_change_tentative, booking_status_change_open, booking_status_change_declined, guest_message_received)
- `target_url` (required, string): HTTPS URL endpoint to receive webhook notifications

**Example:**

```javascript
{
  "event": "booking_new_status_booked",
  "target_url": "https://example.com/webhooks/lodgify"
}
```

### `lodgify_unsubscribe_webhook`

Remove a webhook subscription to stop receiving event notifications. This is a permanent action that cannot be undone.

**Parameters:**

- `id` (required, string): Webhook subscription ID to remove

**Example:**

```javascript
{
  "id": "webhook_123"
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
