// Test exact output for THB
const formatCurrency = require('./dist/mcp/utils/response-enhancer.js').formatCurrency

const result = formatCurrency(1000, 'THB')
console.log('Result:', JSON.stringify(result))
console.log('Expected:', JSON.stringify('THB 1,000.00'))
console.log('Match:', result === 'THB 1,000.00')
console.log('Length:', result.length, 'vs', 'THB 1,000.00'.length)

// Character by character comparison
for (let i = 0; i < Math.max(result.length, 'THB 1,000.00'.length); i++) {
  const r = result.charCodeAt(i) || 'none'
  const e = 'THB 1,000.00'.charCodeAt(i) || 'none'
  if (r !== e) {
    console.log(`Diff at position ${i}: got ${r} expected ${e}`)
  }
}
