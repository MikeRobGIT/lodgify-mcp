/**
 * Messaging API Client Module
 * Handles all messaging-related API operations
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type { MessageThread, ThreadQueryParams } from './types.js'

/**
 * Messaging API Client
 * Manages message threads and communication
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
   */
  async getThread<T = MessageThread>(threadGuid: string, params?: ThreadQueryParams): Promise<T> {
    const sanitized = this.validateThreadGuid(threadGuid)
    return this.request<T>(
      'GET',
      sanitized,
      params ? { params: params as Record<string, unknown> } : {},
    )
  }

  /**
   * List message threads (if API supports it)
   * GET /v2/messaging
   */
  async listThreads<T = MessageThread[]>(params?: ThreadQueryParams): Promise<T> {
    return this.request<T>('GET', '', params ? { params: params as Record<string, unknown> } : {})
  }

  /**
   * Send a message to a thread (if API supports it)
   * POST /v2/messaging/{threadGuid}/messages
   */
  async sendMessage<T = unknown>(
    threadGuid: string,
    message: {
      content: string
      attachments?: Array<{
        fileName: string
        fileUrl: string
        fileType?: string
      }>
    },
  ): Promise<T> {
    const sanitized = this.validateThreadGuid(threadGuid)

    if (!message || !message.content) {
      throw new Error('Message content is required')
    }

    return this.request<T>('POST', `${sanitized}/messages`, {
      body: message,
    })
  }

  /**
   * Mark a thread as read (if API supports it)
   * PUT /v2/messaging/{threadGuid}/read
   */
  async markThreadAsRead<T = unknown>(threadGuid: string): Promise<T> {
    const sanitized = this.validateThreadGuid(threadGuid)
    return this.request<T>('PUT', `${sanitized}/read`)
  }

  /**
   * Archive a thread (if API supports it)
   * PUT /v2/messaging/{threadGuid}/archive
   */
  async archiveThread<T = unknown>(threadGuid: string): Promise<T> {
    const sanitized = this.validateThreadGuid(threadGuid)
    return this.request<T>('PUT', `${sanitized}/archive`)
  }
}
