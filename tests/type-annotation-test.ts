import { normalizeBoolean } from '../src/env.js'

// This test demonstrates that the normalizeBoolean function has the correct type annotation
// that accepts unknown and returns boolean, as required by the tests in env.test.ts

describe('Type Annotation Verification', () => {
  it('should have correct type signature: (value: unknown) => boolean', () => {
    // TypeScript should infer the correct types here
    const result1: boolean = normalizeBoolean('true')
    const result2: boolean = normalizeBoolean(1)
    const result3: boolean = normalizeBoolean(null)
    const result4: boolean = normalizeBoolean(undefined)
    const result5: boolean = normalizeBoolean({})
    const result6: boolean = normalizeBoolean([])
    const result7: boolean = normalizeBoolean(true)
    const result8: boolean = normalizeBoolean(false)

    // All results should be boolean
    expect(typeof result1).toBe('boolean')
    expect(typeof result2).toBe('boolean')
    expect(typeof result3).toBe('boolean')
    expect(typeof result4).toBe('boolean')
    expect(typeof result5).toBe('boolean')
    expect(typeof result6).toBe('boolean')
    expect(typeof result7).toBe('boolean')
    expect(typeof result8).toBe('boolean')

    // Verify the function works as expected
    expect(result1).toBe(true) // 'true' -> true
    expect(result2).toBe(true) // 1 -> true
    expect(result3).toBe(false) // null -> false
    expect(result4).toBe(false) // undefined -> false
    expect(result5).toBe(false) // {} -> false
    expect(result6).toBe(false) // [] -> false
    expect(result7).toBe(true) // true -> true
    expect(result8).toBe(false) // false -> false
  })

  it('should accept any unknown value type', () => {
    // These should all compile without TypeScript errors
    // demonstrating that the function accepts unknown
    normalizeBoolean('string')
    normalizeBoolean(123)
    normalizeBoolean(true)
    normalizeBoolean(false)
    normalizeBoolean(null)
    normalizeBoolean(undefined)
    normalizeBoolean({})
    normalizeBoolean([])
    normalizeBoolean(() => {})
    normalizeBoolean(Symbol('test'))
    normalizeBoolean(new Date())
    normalizeBoolean(new Error('test'))
  })
})
