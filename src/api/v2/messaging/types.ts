/**
 * Messaging API Types
 * Type definitions for messaging-related operations
 */

// Message thread structure (can vary based on actual API response)
export interface MessageThread {
  threadGuid?: string
  messages?: Message[]
  participants?: Participant[]
  propertyId?: string | number
  bookingId?: string | number
  status?: 'open' | 'closed' | 'archived'
  subject?: string
  createdAt?: string
  updatedAt?: string
  // Additional fields based on actual API response
  [key: string]: unknown
}

// Individual message structure
export interface Message {
  id?: string | number
  content?: string
  timestamp?: string
  senderId?: string
  senderName?: string
  senderType?: 'guest' | 'host' | 'system'
  messageType?: 'text' | 'system' | 'notification'
  attachments?: Attachment[]
  // Additional fields based on actual API response
  [key: string]: unknown
}

// Message participant
export interface Participant {
  id?: string | number
  name?: string
  email?: string
  type?: 'guest' | 'host' | 'admin'
  // Additional fields based on actual API response
  [key: string]: unknown
}

// Message attachment
export interface Attachment {
  id?: string | number
  fileName?: string
  fileUrl?: string
  fileType?: string
  fileSize?: number
  // Additional fields based on actual API response
  [key: string]: unknown
}

// Thread query parameters
export interface ThreadQueryParams {
  includeMessages?: boolean
  includeParticipants?: boolean
  messageLimit?: number
  since?: string
}
