/**
 * @fileoverview Messaging Tools Module for Lodgify MCP Server
 * @description Contains all messaging and communication-related MCP tool registrations
 * @author Lodgify MCP Server
 * @since 0.1.20
 *
 * @important As of the latest Lodgify API documentation, only the GET thread
 * endpoint is available in v2. Other messaging operations (send, mark as read,
 * archive, list) are not currently supported.
 *
 * @see {@link https://docs.lodgify.com/discuss/6899e597bd22070fb43002df} Known Issues
 *
 * Known Issues:
 * - v1 messaging endpoints exist but are non-functional (return 200 OK without sending)
 */

import { z } from 'zod'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { wrapToolHandler } from '../utils/error-wrapper.js'
import { sanitizeInput } from '../utils/input-sanitizer.js'
import { enhanceResponse, formatMcpResponse } from '../utils/response/index.js'
import type { ToolCategory, ToolRegistration } from '../utils/types.js'

const CATEGORY: ToolCategory = 'Messaging & Communication'

/**
 * Get all messaging tools for the MCP server
 *
 * @description Currently only includes the getThread tool as it's the only functional
 * messaging endpoint in the Lodgify API v2.
 *
 * @param {() => LodgifyOrchestrator} getClient - Function that returns the Lodgify orchestrator client
 * @returns {ToolRegistration[]} Array of messaging tool registrations
 *
 * @since 0.1.20
 * @category Messaging
 *
 * @example
 * ```typescript
 * const client = () => new LodgifyOrchestrator(apiKey);
 * const messagingTools = getMessagingTools(client);
 * // Returns: [{ name: 'lodgify_get_thread', ... }]
 * ```
 */
export function getMessagingTools(getClient: () => LodgifyOrchestrator): ToolRegistration[] {
  return [
    // Get thread tool - the only functional messaging endpoint
    {
      name: 'lodgify_get_thread',
      category: CATEGORY,
      config: {
        title: 'Get Messaging Thread',
        description: `Retrieve a messaging conversation thread including all messages, participants, and thread metadata.

This is currently the only functional messaging endpoint in Lodgify API v2.
Thread UIDs can be found in booking data (thread_uid field).

For detailed usage instructions and examples, see the TOOL_CATALOG.md documentation.`,
        inputSchema: {
          threadGuid: z
            .string()
            .min(1)
            .describe('Thread UID from booking data (found in thread_uid field)'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        // Sanitize input
        const { threadGuid } = sanitizeInput(input)

        // Note: Thread GUID validation is handled by MessagingClient.validateThreadGuid()
        // which allows broader patterns like "thread_123" in addition to standard UUIDs

        const result = await getClient().messaging.getThread(threadGuid)

        // Enhance the response with context
        const enhanced = enhanceResponse(result, {
          operationType: 'read',
          entityType: 'thread',
          inputParams: { threadGuid },
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_get_thread'),
    },

    // REMOVED TOOLS - These endpoints don't exist in Lodgify API v2:
    // - lodgify_list_threads - GET /v2/messaging endpoint doesn't exist
    // - lodgify_send_message - POST /v2/messaging/{threadGuid}/messages endpoint doesn't exist
    // - lodgify_mark_thread_as_read - PUT /v2/messaging/{threadGuid}/read endpoint doesn't exist
    // - lodgify_archive_thread - PUT /v2/messaging/{threadGuid}/archive endpoint doesn't exist
    //
    // Note: v1 has POST /v1/reservation/booking/{id}/messages and POST /v1/reservation/enquiry/{id}/messages
    // but these are currently non-functional (return 200 OK without sending messages).
    // See: https://docs.lodgify.com/discuss/6899e597bd22070fb43002df
  ]
}
