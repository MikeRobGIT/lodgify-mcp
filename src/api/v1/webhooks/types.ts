/**
 * Webhooks API Types (v1 API)
 * Type definitions for webhook-related operations
 */

// Webhook event types supported by Lodgify API
export type WebhookEventType =
  | 'rate_change'
  | 'availability_change'
  | 'booking_new_any_status'
  | 'booking_new_status_booked'
  | 'booking_change'
  | 'booking_status_change_booked'
  | 'booking_status_change_tentative'
  | 'booking_status_change_open'
  | 'booking_status_change_declined'
  | 'guest_message_received'

// Webhook event structure
export interface WebhookEvent {
  id: string
  event: WebhookEventType
  target_url: string
  created_at?: string
  last_triggered_at?: string
  status?: 'active' | 'failed' | 'paused'
}

// Request to subscribe to a webhook event
export interface WebhookSubscribeRequest {
  target_url: string
  event: WebhookEventType
}

// Response when subscribing to a webhook
export interface WebhookSubscribeResponse {
  id: string
  secret: string
  event: WebhookEventType
  target_url: string
}

// Response when listing webhooks
export interface WebhookListResponse {
  webhooks: WebhookEvent[]
  count: number
}

// Request to unsubscribe from a webhook
export interface WebhookUnsubscribeRequest {
  id: string
}

// Query parameters for listing webhooks
export interface WebhookListParams {
  status?: 'active' | 'failed' | 'paused'
  event?: WebhookEventType
  limit?: number
  offset?: number
}
