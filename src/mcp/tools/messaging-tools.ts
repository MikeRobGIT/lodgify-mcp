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
  ]
}
