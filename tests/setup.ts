import type { Mock } from 'bun:test'
import { afterEach, mock } from 'bun:test'
import { config } from 'dotenv'

// Load test environment variables
config({ path: '.env.test' })

// Set default test environment variables
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error'
process.env.DEBUG_HTTP = '0'

// Define mock console type
interface MockConsole extends Console {
  error: Mock<(...args: unknown[]) => void> & { mockClear(): void }
  warn: Mock<(...args: unknown[]) => void> & { mockClear(): void }
  log: Mock<(...args: unknown[]) => void> & { mockClear(): void }
  info: Mock<(...args: unknown[]) => void> & { mockClear(): void }
  debug: Mock<(...args: unknown[]) => void> & { mockClear(): void }
}

// Mock console methods to reduce test noise
const mockError = mock(() => {}) as MockConsole['error']
const mockWarn = mock(() => {}) as MockConsole['warn']
const mockLog = mock(() => {}) as MockConsole['log']
const mockInfo = mock(() => {}) as MockConsole['info']
const mockDebug = mock(() => {}) as MockConsole['debug']

global.console = {
  ...console,
  error: mockError,
  warn: mockWarn,
  log: mockLog,
  info: mockInfo,
  debug: mockDebug,
} as MockConsole

// Reset mocks after each test
afterEach(() => {
  // Clear all mock calls
  mockError.mockClear()
  mockWarn.mockClear()
  mockLog.mockClear()
  mockInfo.mockClear()
  mockDebug.mockClear()
})
