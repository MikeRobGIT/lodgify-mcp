/**
 * Messaging Tools Module
 * Contains all messaging and communication-related MCP tool registrations
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { isISODateTime } from '../utils/date-format.js'
// Types from messaging API (imported for reference but not used in declarations)
import { wrapToolHandler } from '../utils/error-wrapper.js'
import { sanitizeInput, validateGuid } from '../utils/input-sanitizer.js'
import type { ToolCategory, ToolRegistration } from '../utils/types.js'

const CATEGORY: ToolCategory = 'Messaging & Communication'

/**
 * Get all messaging tools
 */
export function getMessagingTools(getClient: () => LodgifyOrchestrator): ToolRegistration[] {
  return [
    // Get thread tool
    {
      name: 'lodgify_get_thread',
      category: CATEGORY,
      config: {
        title: 'Get Messaging Thread',
        description: `Retrieve a messaging conversation thread including all messages, participants, and thread metadata. Use this for customer service inquiries, guest communication history, or managing ongoing conversations with guests and staff.

Example request:
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000"  // Unique thread identifier (GUID) for the conversation
}`,
        inputSchema: {
          threadGuid: z
            .string()
            .min(1)
            .describe('Unique thread identifier (GUID) for the conversation'),
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
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_get_thread'),
    },

    // List threads tool
    {
      name: 'lodgify_list_threads',
      category: CATEGORY,
      config: {
        title: 'List Messaging Threads',
        description: `List conversation threads with optional filtering. Useful for inbox views, triage, and audit of guest communications.

Example request:
{
  "params": {
    "includeMessages": true,        // Include messages in response (optional)
    "includeParticipants": true,    // Include participant details (optional)
    "messageLimit": 50,             // Maximum messages per thread, 1-200 (optional)
    "since": "2024-03-01T00:00:00Z" // ISO date-time to filter threads since (optional)
  }
}`,
        inputSchema: {
          params: z
            .object({
              includeMessages: z.boolean().optional(),
              includeParticipants: z.boolean().optional(),
              messageLimit: z.number().int().min(1).max(200).optional(),
              since: z.string().optional().describe('ISO date-time to filter threads since'),
            })
            .optional(),
        },
      },
      handler: wrapToolHandler(async (input) => {
        // Sanitize input
        const { params } = sanitizeInput(input)

        // Additional validation for date parameter if present
        if (params?.since) {
          if (!isISODateTime(params.since)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Invalid date format for since parameter. Use ISO 8601 format (e.g., 2024-03-01T00:00:00Z)',
            )
          }
        }

        const result = await getClient().messaging.listThreads(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_list_threads'),
    },

    // Send message tool (WRITE)
    {
      name: 'lodgify_send_message',
      category: CATEGORY,
      config: {
        title: 'Send Message To Thread',
        description: `Send a message to a specific conversation thread. Respects read-only mode and will be blocked when enabled.

Example request:
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000",  // Thread GUID
  "message": {
    "content": "Thank you for your inquiry about the Ocean View Villa.",  // Message content
    "attachments": [                                                      // Optional attachments
      {
        "fileName": "villa_photos.pdf",                                  // File name
        "fileUrl": "https://example.com/files/villa_photos.pdf",         // File URL
        "fileType": "application/pdf"                                    // File MIME type (optional)
      }
    ]
  }
}`,
        inputSchema: {
          threadGuid: z.string().min(1).describe('Thread GUID'),
          message: z
            .object({
              content: z.string().min(1).describe('Message content'),
              attachments: z
                .array(
                  z.object({
                    fileName: z.string(),
                    fileUrl: z.string().url(),
                    fileType: z.string().optional(),
                  }),
                )
                .optional(),
            })
            .describe('Message payload'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        // Sanitize input
        const { threadGuid, message } = sanitizeInput(input)

        // Validate GUID format
        if (!validateGuid(threadGuid)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid thread GUID format. Must be a valid UUID/GUID.',
          )
        }

        // Validate message content is not empty
        if (!message.content || message.content.trim().length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'Message content cannot be empty')
        }

        const result = await getClient().messaging.sendMessage(threadGuid, message)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_send_message'),
    },

    // Mark thread as read (WRITE)
    {
      name: 'lodgify_mark_thread_as_read',
      category: CATEGORY,
      config: {
        title: 'Mark Thread As Read',
        description: `Mark a conversation thread as read to clear unread indicators. Respects read-only mode and will be blocked when enabled.

Example request:
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000"  // Thread GUID
}`,
        inputSchema: {
          threadGuid: z.string().min(1).describe('Thread GUID'),
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

        const result = await getClient().messaging.markThreadAsRead(threadGuid)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_mark_thread_as_read'),
    },

    // Archive thread (WRITE)
    {
      name: 'lodgify_archive_thread',
      category: CATEGORY,
      config: {
        title: 'Archive Thread',
        description: `Archive a conversation thread to remove it from active views. Respects read-only mode and will be blocked when enabled.

Example request:
{
  "threadGuid": "550e8400-e29b-41d4-a716-446655440000"  // Thread GUID
}`,
        inputSchema: {
          threadGuid: z.string().min(1).describe('Thread GUID'),
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

        const result = await getClient().messaging.archiveThread(threadGuid)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_archive_thread'),
    },
  ]
}
