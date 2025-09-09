# Lodgify MCP Tool Catalog

Complete reference for all available Lodgify MCP tools and their parameters.

## Property Management

### `lodgify_list_properties`

List all properties with optional filtering and pagination.

**Parameters:**

- `wid` (optional): Website ID
- `updatedSince` (optional): Return only properties modified since this datetime
- `includeCount` (optional): Return the total number of results (default: false)
- `includeInOut` (optional): Include available dates for arrival or departure (default: false)
- `page` (optional): Page number to retrieve (default: 1)
- `size` (optional): Number of items per page (max 50, default: 50)

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

- `id` (required): Property ID
- `wid` (optional): Website ID
- `includeInOut` (optional): Include available dates for arrival or departure (default: false)

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

- `propertyId` (required): Property ID to list room types for

**Example:**

```javascript
{
  "propertyId": "684855"
}
```

### `lodgify_list_deleted_properties`

List properties that have been deleted.

**Parameters:**

- `params` (optional): Query parameters for filtering
  - `deletedSince`: Filter properties deleted after this date

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

- `page` (optional): Page number to retrieve (default: 1)
- `size` (optional): Number of items per page (max: 50, default: 50)
- `includeCount` (optional): Include total number of results (default: false)
- `includeExternal` (optional): Include external bookings (default: false)
- `includeQuoteDetails` (optional): Include quote details (default: false)
- `includeTransactions` (optional): Include details about transactions and schedule (default: false)
- `stayFilter` (optional, default: `Upcoming`): Filter bookings by stay dates (Upcoming, Current, Historic, All, ArrivalDate, DepartureDate). Prefer `Upcoming`; avoid `All` unless absolutely necessary.
- `stayFilterDate` (optional): Date to filter when using `ArrivalDate` or `DepartureDate` in `stayFilter`
- `updatedSince` (optional): Include only bookings updated since this date
- `trash` (optional): Query bookings that are in trash (False, True, All)

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

- `id` (required): Unique booking/reservation ID to retrieve

**Example:**

```javascript
{
  "id": "BK001"
}
```

### `lodgify_get_booking_payment_link`

Get existing payment link for a booking including payment status, amount due, and link expiration.

**Parameters:**

- `id` (required): Booking ID to get payment link for

**Example:**

```javascript
{
  "id": "book-456"
}
```

### `lodgify_create_booking_payment_link`

Generate a secure payment link for a booking allowing guests to pay outstanding balances online.

**Parameters:**

- `id` (required): Booking ID to create payment link for
- `payload` (required): Payment link configuration
  - `amount` (optional): Payment amount (defaults to booking balance)
  - `currency` (optional): Currency code (e.g., USD, EUR)
  - `description` (optional): Payment description for guest (max 500 chars)

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

- `id` (required): Booking ID to update key codes for
- `payload` (required): Access key codes and entry information
  - `keyCodes` (required): Array of access codes/keys for the property

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

- `id` (required): Booking ID to check in
- `time` (required): Check-in time in ISO 8601 date-time format

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

- `id` (required): Booking ID to check out
- `time` (required): Check-out time in ISO 8601 date-time format

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

- `id` (required): Property ID to get external bookings for

**Example:**

```javascript
{
  "id": "684855"
}
```

### `lodgify_create_booking`

Create a new booking in the system. This v1 endpoint provides direct booking creation functionality.

**Parameters:**

- `property_id` (required): Property ID for the booking
- `room_type_id` (required): Room type ID
- `arrival` (required): Arrival date (YYYY-MM-DD)
- `departure` (required): Departure date (YYYY-MM-DD)
- `guest_name` (required): Primary guest name
- `adults` (required): Number of adult guests (minimum 1)
- `guest_email` (optional): Guest email address
- `guest_phone` (optional): Guest phone number
- `children` (optional): Number of children (default: 0)
- `infants` (optional): Number of infants
- `status` (optional): Booking status (booked, tentative, declined, confirmed)
- `source` (optional): Booking source or channel
- `notes` (optional): Internal notes or special requests

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

- `id` (required): Booking ID to update
- `arrival` (optional): New arrival date (YYYY-MM-DD)
- `departure` (optional): New departure date (YYYY-MM-DD)
- `guest_name` (optional): Updated guest name
- `guest_email` (optional): Updated guest email
- `guest_phone` (optional): Updated guest phone
- `adults` (optional): Updated number of adults (minimum 1)
- `children` (optional): Updated number of children
- `infants` (optional): Updated number of infants
- `property_id` (optional): New property ID
- `room_type_id` (optional): New room type ID
- `status` (optional): Updated booking status
- `source` (optional): Updated booking source
- `notes` (optional): Updated notes

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

- `id` (required): Booking ID to delete permanently

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

- `roomTypeId` (required): Room Type ID
- `houseId` (required): House/Property ID
- `startDate` (required): Start date for rates calendar (YYYY-MM-DD)
- `endDate` (required): End date for rates calendar (YYYY-MM-DD)

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

- `params` (required): Query parameters for rate settings
  - `houseId` (optional): Property ID

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

- `property_id` (required): Property ID to update rates for
- `rates` (required): Array of rate updates to apply
  - `room_type_id` (required): Room type ID
  - `start_date` (required): Start date for rate period (YYYY-MM-DD)
  - `end_date` (required): End date for rate period (YYYY-MM-DD)
  - `price_per_day` (required): Rate amount per day
  - `min_stay` (optional): Minimum stay requirement
  - `currency` (optional): Currency code (e.g., USD, EUR)

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

- `bookingId` (required): Booking ID to create quote for
- `payload` (required): Quote creation payload with pricing and terms
  - `totalPrice` (optional): Total quote amount
  - `currency` (optional): Currency code (e.g., USD, EUR)
  - `subtotal` (optional): Subtotal before taxes/fees
  - `breakdown` (optional): Price breakdown details
    - `accommodation` (optional): Accommodation cost
    - `taxes` (optional): Tax amount
    - `fees` (optional): Service fees
    - `extras` (optional): Extra services cost
    - `discount` (optional): Discount amount
  - `adjustments` (optional): Custom pricing adjustments array
    - `type` (required): Type of adjustment (discount, fee, tax, extra)
    - `description` (required): Description of adjustment
    - `amount` (required): Adjustment amount
    - `isPercentage` (optional): Is this a percentage?
  - `validUntil` (optional): Quote expiration date (ISO 8601)
  - `sendToGuest` (optional): Send quote to guest via email
  - `replaceExisting` (optional): Replace existing quote if any
  - `notes` (optional): Internal notes about the quote
  - `customTerms` (optional): Custom terms and conditions
  - `policyId` (optional): Cancellation policy ID
  - `rentalAgreementId` (optional): Rental agreement ID

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

- `propertyId` (required): Property ID with existing booking/quote
- `params` (required): Quote retrieval parameters
  - Dates (from/to) that match the booking
  - Room types (roomTypes[0].Id)  
  - Guest breakdown (guest_breakdown[adults])
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

### `lodgify_list_threads`

List conversation threads with optional filtering. Useful for inbox views, triage, and audit of guest communications.

**Parameters:**

- `params` (optional): Query parameters for filtering
  - `includeMessages` (optional): Include messages in response
  - `includeParticipants` (optional): Include participant details
  - `messageLimit` (optional): Maximum messages per thread, 1-200
  - `since` (optional): ISO date-time to filter threads since

**Example:**

```javascript
{
  "params": {
    "includeMessages": true,
    "includeParticipants": true,
    "messageLimit": 50,
    "since": "2024-03-01T00:00:00Z"
  }
}
```

### `lodgify_get_thread`

Retrieve a messaging conversation thread including all messages, participants, and thread metadata.

**Parameters:**

- `threadGuid` (required): Unique thread identifier (GUID) for the conversation

**Example:**

```javascript
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `lodgify_send_message`

Send a message to a specific conversation thread. Respects read-only mode and will be blocked when enabled.

**Parameters:**

- `threadGuid` (required): Thread GUID
- `message` (required): Message payload
  - `content` (required): Message content
  - `attachments` (optional): Array of attachment objects
    - `fileName` (required): File name
    - `fileUrl` (required): File URL
    - `fileType` (optional): File MIME type

**Example:**

```javascript
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000",
  "message": {
    "content": "Thank you for your inquiry about the Ocean View Villa.",
    "attachments": [
      {
        "fileName": "villa_photos.pdf",
        "fileUrl": "https://example.com/files/villa_photos.pdf",
        "fileType": "application/pdf"
      }
    ]
  }
}
```

### `lodgify_mark_thread_read`

Mark a conversation thread as read to clear unread indicators. Respects read-only mode and will be blocked when enabled.

**Parameters:**

- `threadGuid` (required): Thread GUID

**Example:**

```javascript
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `lodgify_archive_thread`

Archive a conversation thread to remove it from active views. Respects read-only mode and will be blocked when enabled.

**Parameters:**

- `threadGuid` (required): Thread GUID

**Example:**

```javascript
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Property Discovery & Helper Tools

### `lodgify_find_properties`

Find properties in the system when you don't know the exact property ID. Searches properties by name and gets property IDs from bookings.

**Parameters:**

- `searchTerm` (optional): Search term to filter properties by name (case-insensitive)
- `includePropertyIds` (optional): Include property IDs found in recent bookings (default: true)
- `limit` (optional): Maximum number of properties to return (default: 10, max: 50)

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

- `propertyId` (required): Property ID
- `params` (optional): Query parameters
  - `from` (optional): Start date (YYYY-MM-DD or ISO date-time format)
  - `to` (optional): End date (YYYY-MM-DD or ISO date-time format)

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

- `event` (required): Event type to subscribe to (rate_change, availability_change, booking_new_any_status, booking_new_status_booked, booking_change, booking_status_change_booked, booking_status_change_tentative, booking_status_change_open, booking_status_change_declined, guest_message_received)
- `target_url` (required): HTTPS URL endpoint to receive webhook notifications

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

- `id` (required): Webhook subscription ID to remove

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
