/**
 * Messaging API Client Module
 * Handles all messaging-related API operations
 *
 * IMPORTANT: As of the latest API documentation, only the GET thread endpoint
 * is available in v2. Other messaging operations (send, mark as read, archive, list)
 * are not currently supported by the Lodgify API v2.
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type { MessageThread, ThreadQueryParams } from './types.js'

/**
 * Messaging API Client
 * Currently only supports retrieving thread details.
 *
 * Note: Lodgify v1 has POST endpoints for sending messages to bookings/enquiries,
 * but these are currently non-functional (returning 200 OK without executing).
 * See: https://docs.lodgify.com/discuss/6899e597bd22070fb43002df
 */
export class MessagingClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'messaging',
      version: 'v2',
      basePath: 'messaging',
    }
    super(client, config)
  }

  /**
   * Validate and sanitize thread GUID
   */
  private validateThreadGuid(threadGuid: string): string {
    if (!threadGuid || typeof threadGuid !== 'string') {
      throw new Error('Thread GUID is required and must be a string')
    }

    // Allow GUID format (alphanumeric, hyphens, underscores)
    const sanitized = threadGuid.replace(/[^a-zA-Z0-9_-]/g, '')

    if (sanitized !== threadGuid || sanitized.length === 0 || sanitized.length > 100) {
      throw new Error('Thread GUID contains invalid characters or invalid length')
    }

    return sanitized
  }

  /**
   * Get a messaging thread
   * GET /v2/messaging/{threadGuid}
   *
   * This is the only messaging endpoint currently available in v2.
   * Thread UIDs can be found in booking data (thread_uid field).
   */
  async getThread<T = MessageThread>(threadGuid: string, params?: ThreadQueryParams): Promise<T> {
    const sanitized = this.validateThreadGuid(threadGuid)
    return this.request<T>(
      'GET',
      sanitized,
      params ? { params: params as Record<string, unknown> } : {},
    )
  }

  // Note: The following methods have been removed as they don't exist in the Lodgify API v2:
  // - listThreads() - GET /v2/messaging endpoint doesn't exist
  // - sendMessage() - POST /v2/messaging/{threadGuid}/messages endpoint doesn't exist
  // - markThreadAsRead() - PUT /v2/messaging/{threadGuid}/read endpoint doesn't exist
  // - archiveThread() - PUT /v2/messaging/{threadGuid}/archive endpoint doesn't exist
}
