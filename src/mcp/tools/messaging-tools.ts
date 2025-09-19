/**
 * Messaging Tools Module
 * Contains all messaging and communication-related MCP tool registrations
 *
 * IMPORTANT: As of the latest Lodgify API documentation, only the GET thread
 * endpoint is available in v2. Other messaging operations (send, mark as read,
 * archive, list) are not currently supported.
 *
 * Known Issues:
 * - v1 messaging endpoints exist but are non-functional (return 200 OK without sending)
 * - See: https://docs.lodgify.com/discuss/6899e597bd22070fb43002df
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { wrapToolHandler } from '../utils/error-wrapper.js'
import { sanitizeInput, validateGuid } from '../utils/input-sanitizer.js'
import { enhanceResponse, formatMcpResponse } from '../utils/response/index.js'
import type { ToolCategory, ToolRegistration } from '../utils/types.js'

const CATEGORY: ToolCategory = 'Messaging & Communication'

/**
 * Get all messaging tools
 *
 * Currently only includes the getThread tool as it's the only functional
 * messaging endpoint in the Lodgify API v2.
 */
export function getMessagingTools(getClient: () => LodgifyOrchestrator): ToolRegistration[] {
  return [
    // Get thread tool - THE ONLY FUNCTIONAL MESSAGING ENDPOINT
    {
      name: 'lodgify_get_thread',
      category: CATEGORY,
      config: {
        title: 'Get Messaging Thread',
        description: `Retrieve a messaging conversation thread including all messages, participants, and thread metadata.

This is currently the ONLY functional messaging endpoint in Lodgify API v2.

To find thread UIDs:
1. Get a booking using lodgify_get_booking
2. Look for the "thread_uid" field in the booking data
3. Use that UUID with this tool to retrieve the conversation

LIMITATIONS:
- Cannot send messages (v1 endpoints exist but are broken)
- Cannot mark threads as read (endpoint doesn't exist)
- Cannot archive threads (endpoint doesn't exist)
- Cannot list all threads (endpoint doesn't exist)

Example request:
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000"  // Thread UID from booking data
}`,
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

        // Validate GUID format
        if (!validateGuid(threadGuid)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid thread GUID format. Must be a valid UUID/GUID.',
          )
        }

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
