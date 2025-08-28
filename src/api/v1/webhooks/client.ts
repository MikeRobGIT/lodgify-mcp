/**
 * Webhooks API Client Module (v1 API)
 * Handles all webhook-related API operations
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type {
  WebhookListParams,
  WebhookListResponse,
  WebhookSubscribeRequest,
  WebhookSubscribeResponse,
  WebhookUnsubscribeRequest,
} from './types.js'

/**
 * Webhooks API Client (v1 API)
 * Manages webhook subscriptions and event notifications
 */
export class WebhooksClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'webhooks',
      version: 'v1',
      basePath: 'webhooks/v1',
    }
    super(client, config)
  }

  /**
   * List all webhooks (v1 API)
   * GET /webhooks/v1/list
   */
  async listWebhooks(params?: WebhookListParams): Promise<WebhookListResponse> {
    return this.request<WebhookListResponse>(
      'GET',
      'list',
      params ? { params: params as Record<string, unknown> } : {},
    )
  }

  /**
   * Subscribe to a webhook event (v1 API)
   * POST /webhooks/v1/subscribe
   */
  async subscribeWebhook(data: WebhookSubscribeRequest): Promise<WebhookSubscribeResponse> {
    if (!data || typeof data !== 'object') {
      throw new Error('Webhook subscription data is required')
    }

    if (!data.target_url || !data.event) {
      throw new Error('Both target_url and event are required for webhook subscription')
    }

    // Validate URL format
    try {
      new URL(data.target_url)
    } catch {
      throw new Error('target_url must be a valid URL')
    }

    return this.request<WebhookSubscribeResponse>('POST', 'subscribe', {
      body: data,
    })
  }

  /**
   * Unsubscribe from a webhook (v1 API)
   * DELETE /webhooks/v1/unsubscribe
   */
  async unsubscribeWebhook(data: WebhookUnsubscribeRequest): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw new Error('Webhook unsubscribe data is required')
    }

    if (!data.id) {
      throw new Error('Webhook ID is required for unsubscribing')
    }

    return this.request<void>('DELETE', 'unsubscribe', {
      body: data,
    })
  }

  /**
   * Delete a specific webhook by ID (alternative method)
   * DELETE /webhooks/v1/{id}
   */
  async deleteWebhook(id: string): Promise<void> {
    if (!id) {
      throw new Error('Webhook ID is required')
    }

    return this.request<void>('DELETE', id)
  }
}
