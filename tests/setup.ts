import { mock, afterEach } from 'bun:test'
import { config } from 'dotenv'

// Load test environment variables
config({ path: '.env.test' })

// Set default test environment variables
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error'
process.env.DEBUG_HTTP = '0'

// Mock console methods to reduce test noise
global.console = {
  ...console,
  error: mock(() => {}),
  warn: mock(() => {}),
  log: mock(() => {}),
  info: mock(() => {}),
  debug: mock(() => {}),
}

// Reset mocks after each test
afterEach(() => {
  // Clear all mock calls
  (global.console.error as any).mockClear();
  (global.console.warn as any).mockClear();
  (global.console.log as any).mockClear();
  (global.console.info as any).mockClear();
  (global.console.debug as any).mockClear();
})