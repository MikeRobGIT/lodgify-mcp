import { describe, expect, it } from 'bun:test'
import { loadNamespaceResources, validateNamespace } from '../../../../src/mcp/utils/i18n/resources'

describe('validateNamespace', () => {
  describe('Valid namespaces', () => {
    it('should accept alphanumeric namespace', () => {
      expect(validateNamespace('validator')).toBe('validator')
      expect(validateNamespace('namespace123')).toBe('namespace123')
      expect(validateNamespace('ABC123xyz')).toBe('ABC123xyz')
    })

    it('should accept namespace with hyphens', () => {
      expect(validateNamespace('date-validator')).toBe('date-validator')
      expect(validateNamespace('my-namespace-123')).toBe('my-namespace-123')
    })

    it('should accept namespace with underscores', () => {
      expect(validateNamespace('user_settings')).toBe('user_settings')
      expect(validateNamespace('api_v2_responses')).toBe('api_v2_responses')
    })

    it('should accept mixed valid characters', () => {
      expect(validateNamespace('my-namespace_v2-final')).toBe('my-namespace_v2-final')
      expect(validateNamespace('TEST_123-abc')).toBe('TEST_123-abc')
    })

    it('should accept single character namespace', () => {
      expect(validateNamespace('a')).toBe('a')
      expect(validateNamespace('1')).toBe('1')
    })

    it('should accept maximum length namespace (100 chars)', () => {
      const longNamespace = 'a'.repeat(100)
      expect(validateNamespace(longNamespace)).toBe(longNamespace)
    })
  })

  describe('Path traversal prevention', () => {
    it('should reject namespace with dots for parent directory traversal', () => {
      expect(() => validateNamespace('..')).toThrow(
        'Invalid namespace: ".." contains invalid characters',
      )
      expect(() => validateNamespace('../..')).toThrow(
        'Invalid namespace: "../.." contains invalid characters',
      )
      expect(() => validateNamespace('../../etc/passwd')).toThrow(
        'Invalid namespace: "../../etc/passwd" contains invalid characters',
      )
    })

    it('should reject namespace with single dot', () => {
      expect(() => validateNamespace('.')).toThrow(
        'Invalid namespace: "." contains invalid characters',
      )
      expect(() => validateNamespace('./namespace')).toThrow(
        'Invalid namespace: "./namespace" contains invalid characters',
      )
    })

    it('should reject namespace with forward slashes', () => {
      expect(() => validateNamespace('ns/with/path')).toThrow(
        'Invalid namespace: "ns/with/path" contains invalid characters',
      )
      expect(() => validateNamespace('/etc/passwd')).toThrow(
        'Invalid namespace: "/etc/passwd" contains invalid characters',
      )
      expect(() => validateNamespace('locales/en/validator')).toThrow(
        'Invalid namespace: "locales/en/validator" contains invalid characters',
      )
    })

    it('should reject namespace with backslashes', () => {
      expect(() => validateNamespace('ns\\with\\path')).toThrow(
        'Invalid namespace: "ns\\with\\path" contains invalid characters',
      )
      expect(() => validateNamespace('C:\\Windows\\System32')).toThrow(
        'Invalid namespace: "C:\\Windows\\System32" contains invalid characters',
      )
    })

    it('should reject namespace with mixed path traversal attempts', () => {
      expect(() => validateNamespace('../../../root')).toThrow(
        'Invalid namespace: "../../../root" contains invalid characters',
      )
      expect(() => validateNamespace('..\\..\\windows')).toThrow(
        'Invalid namespace: "..\\..\\windows" contains invalid characters',
      )
      expect(() => validateNamespace('ns/../etc')).toThrow(
        'Invalid namespace: "ns/../etc" contains invalid characters',
      )
    })

    it('should reject namespace with URL-encoded path traversal', () => {
      expect(() => validateNamespace('%2e%2e%2f')).toThrow(
        'Invalid namespace: "%2e%2e%2f" contains invalid characters',
      )
      expect(() => validateNamespace('%2E%2E%2F')).toThrow(
        'Invalid namespace: "%2E%2E%2F" contains invalid characters',
      )
    })

    it('should reject namespace with null bytes', () => {
      expect(() => validateNamespace('namespace\x00.txt')).toThrow(
        'Invalid namespace: "namespace\x00.txt" contains invalid characters',
      )
    })
  })

  describe('Invalid character rejection', () => {
    it('should reject namespace with spaces', () => {
      expect(() => validateNamespace('my namespace')).toThrow(
        'Invalid namespace: "my namespace" contains invalid characters',
      )
      expect(() => validateNamespace(' namespace')).toThrow(
        'Invalid namespace: " namespace" contains invalid characters',
      )
      expect(() => validateNamespace('namespace ')).toThrow(
        'Invalid namespace: "namespace " contains invalid characters',
      )
    })

    it('should reject namespace with special characters', () => {
      expect(() => validateNamespace('ns!@#$%')).toThrow(
        'Invalid namespace: "ns!@#$%" contains invalid characters',
      )
      expect(() => validateNamespace('ns&*()')).toThrow(
        'Invalid namespace: "ns&*()" contains invalid characters',
      )
      expect(() => validateNamespace('ns[]{}=')).toThrow(
        'Invalid namespace: "ns[]{}=" contains invalid characters',
      )
      expect(() => validateNamespace('ns+<>?')).toThrow(
        'Invalid namespace: "ns+<>?" contains invalid characters',
      )
    })

    it('should reject namespace with Unicode characters', () => {
      expect(() => validateNamespace('namespace😊')).toThrow(
        'Invalid namespace: "namespace😊" contains invalid characters',
      )
      expect(() => validateNamespace('名前空間')).toThrow(
        'Invalid namespace: "名前空間" contains invalid characters',
      )
      expect(() => validateNamespace('ñamespace')).toThrow(
        'Invalid namespace: "ñamespace" contains invalid characters',
      )
    })

    it('should reject namespace with quotes', () => {
      expect(() => validateNamespace('"namespace"')).toThrow('contains invalid characters')
      expect(() => validateNamespace("'namespace'")).toThrow('contains invalid characters')
      expect(() => validateNamespace('`namespace`')).toThrow('contains invalid characters')
    })

    it('should reject namespace with semicolons and colons', () => {
      expect(() => validateNamespace('ns;cmd')).toThrow(
        'Invalid namespace: "ns;cmd" contains invalid characters',
      )
      expect(() => validateNamespace('ns:cmd')).toThrow(
        'Invalid namespace: "ns:cmd" contains invalid characters',
      )
    })

    it('should reject namespace with pipe characters', () => {
      expect(() => validateNamespace('ns|cmd')).toThrow(
        'Invalid namespace: "ns|cmd" contains invalid characters',
      )
    })

    it('should reject namespace with dollar signs', () => {
      expect(() => validateNamespace('$namespace')).toThrow(
        'Invalid namespace: "$namespace" contains invalid characters',
      )
      expect(() => validateNamespace('ns$var')).toThrow(
        'Invalid namespace: "ns$var" contains invalid characters',
      )
    })
  })

  describe('Length validation', () => {
    it('should reject namespace exceeding 100 characters', () => {
      const longNamespace = 'a'.repeat(101)
      expect(() => validateNamespace(longNamespace)).toThrow(
        `Invalid namespace: "${longNamespace}" exceeds maximum length`,
      )
    })

    it('should reject very long namespace attempts', () => {
      const veryLongNamespace = 'x'.repeat(1000)
      expect(() => validateNamespace(veryLongNamespace)).toThrow('exceeds maximum length')
    })
  })

  describe('Empty and invalid input', () => {
    it('should reject empty string', () => {
      expect(() => validateNamespace('')).toThrow(
        'Invalid namespace: namespace must be a non-empty string',
      )
    })

    it('should reject whitespace-only string', () => {
      expect(() => validateNamespace('   ')).toThrow(
        'Invalid namespace: "   " contains invalid characters',
      )
      expect(() => validateNamespace('\t')).toThrow(
        'Invalid namespace: "\t" contains invalid characters',
      )
      expect(() => validateNamespace('\n')).toThrow(
        'Invalid namespace: "\n" contains invalid characters',
      )
    })

    it('should reject null and undefined with type checking', () => {
      // @ts-expect-error Testing invalid input
      expect(() => validateNamespace(null)).toThrow(
        'Invalid namespace: namespace must be a non-empty string',
      )
      // @ts-expect-error Testing invalid input
      expect(() => validateNamespace(undefined)).toThrow(
        'Invalid namespace: namespace must be a non-empty string',
      )
    })

    it('should reject non-string types', () => {
      // @ts-expect-error Testing invalid input
      expect(() => validateNamespace(123)).toThrow(
        'Invalid namespace: namespace must be a non-empty string',
      )
      // @ts-expect-error Testing invalid input
      expect(() => validateNamespace({})).toThrow(
        'Invalid namespace: namespace must be a non-empty string',
      )
      // @ts-expect-error Testing invalid input
      expect(() => validateNamespace([])).toThrow(
        'Invalid namespace: namespace must be a non-empty string',
      )
      // @ts-expect-error Testing invalid input
      expect(() => validateNamespace(true)).toThrow(
        'Invalid namespace: namespace must be a non-empty string',
      )
    })
  })

  describe('Integration with loadNamespaceResources', () => {
    it('should validate namespace when loading resources', () => {
      // This will fail because the file doesn't exist, but we're testing that validation happens first
      expect(() => loadNamespaceResources('../etc/passwd', 'en')).toThrow(
        'Invalid namespace: "../etc/passwd" contains invalid characters',
      )
    })

    it('should validate namespace with path traversal in loadNamespaceResources', () => {
      expect(() => loadNamespaceResources('../../secret', 'en')).toThrow(
        'Invalid namespace: "../../secret" contains invalid characters',
      )
    })

    it('should validate namespace with slashes in loadNamespaceResources', () => {
      expect(() => loadNamespaceResources('locales/en/test', 'en')).toThrow(
        'Invalid namespace: "locales/en/test" contains invalid characters',
      )
    })
  })

  describe('Security edge cases', () => {
    it('should reject namespace with command injection attempts', () => {
      expect(() => validateNamespace('ns`rm -rf /`')).toThrow('contains invalid characters')
      expect(() => validateNamespace('ns$(whoami)')).toThrow('contains invalid characters')
      expect(() => validateNamespace('ns;ls -la')).toThrow('contains invalid characters')
      expect(() => validateNamespace('ns&&pwd')).toThrow('contains invalid characters')
      expect(() => validateNamespace('ns||id')).toThrow('contains invalid characters')
    })

    it('should reject namespace with file extension spoofing', () => {
      expect(() => validateNamespace('namespace.json')).toThrow('contains invalid characters')
      expect(() => validateNamespace('namespace.txt')).toThrow('contains invalid characters')
      expect(() => validateNamespace('namespace.js')).toThrow('contains invalid characters')
    })

    it('should reject namespace trying to access hidden files', () => {
      expect(() => validateNamespace('.env')).toThrow('contains invalid characters')
      expect(() => validateNamespace('.gitconfig')).toThrow('contains invalid characters')
      expect(() => validateNamespace('.ssh')).toThrow('contains invalid characters')
    })

    it('should reject namespace with environment variable expansion attempts', () => {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal rejection
      expect(() => validateNamespace('${HOME}')).toThrow('contains invalid characters')
      expect(() => validateNamespace('$HOME')).toThrow('contains invalid characters')
      expect(() => validateNamespace('%USERPROFILE%')).toThrow('contains invalid characters')
    })
  })
})
