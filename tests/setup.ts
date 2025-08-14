import { vi } from 'vitest'
import { config } from 'dotenv'

// Load test environment variables
config({ path: '.env.test' })

// Set default test environment variables
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error'
process.env.DEBUG_HTTP = '0'

// Mock console methods to reduce test noise
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks()
})