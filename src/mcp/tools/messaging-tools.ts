/**
 * Messaging Tools Module
 * Contains all messaging and communication-related MCP tool registrations
 */

import { z } from 'zod'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
// Types from messaging API (imported for reference but not used in declarations)
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
        description:
          'Retrieve a messaging conversation thread including all messages, participants, and thread metadata. Use this for customer service inquiries, guest communication history, or managing ongoing conversations with guests and staff.',
        inputSchema: {
          threadGuid: z
            .string()
            .min(1)
            .describe('Unique thread identifier (GUID) for the conversation'),
        },
      },
      handler: async ({ threadGuid }) => {
        const result = await getClient().messaging.getThread(threadGuid)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // List threads tool
    {
      name: 'lodgify_list_threads',
      category: CATEGORY,
      config: {
        title: 'List Messaging Threads',
        description:
          'List conversation threads with optional filtering. Useful for inbox views, triage, and audit of guest communications.',
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
      handler: async ({ params }) => {
        const result = await getClient().listThreads(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Send message tool (WRITE)
    {
      name: 'lodgify_send_message',
      category: CATEGORY,
      config: {
        title: 'Send Message To Thread',
        description:
          'Send a message to a specific conversation thread. Respects read-only mode and will be blocked when enabled.',
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
      handler: async ({ threadGuid, message }) => {
        const result = await getClient().sendMessage(threadGuid, message)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Mark thread as read (WRITE)
    {
      name: 'lodgify_mark_thread_read',
      category: CATEGORY,
      config: {
        title: 'Mark Thread As Read',
        description:
          'Mark a conversation thread as read to clear unread indicators. Respects read-only mode and will be blocked when enabled.',
        inputSchema: {
          threadGuid: z.string().min(1).describe('Thread GUID'),
        },
      },
      handler: async ({ threadGuid }) => {
        const result = await getClient().markThreadAsRead(threadGuid)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Archive thread (WRITE)
    {
      name: 'lodgify_archive_thread',
      category: CATEGORY,
      config: {
        title: 'Archive Thread',
        description:
          'Archive a conversation thread to remove it from active views. Respects read-only mode and will be blocked when enabled.',
        inputSchema: {
          threadGuid: z.string().min(1).describe('Thread GUID'),
        },
      },
      handler: async ({ threadGuid }) => {
        const result = await getClient().archiveThread(threadGuid)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },
  ]
}
