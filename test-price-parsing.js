// Test script for price parsing
const csvService = require('./services/csvService');

console.log('🧪 Testing Price Parsing...\n');

// Test cases with expected results
const testCases = [
  { input: '10,6 900', expected: 106900, description: 'European thousands separator with space' },
  { input: '10,600', expected: 10600, description: 'European thousands separator' },
  { input: '10,6', expected: 10.6, description: 'European decimal separator' },
  { input: '1,234.56', expected: 1234.56, description: 'US format with decimal' },
  { input: '1 234,56', expected: 1234.56, description: 'European format with space and decimal' },
  { input: '€1,234', expected: 1234, description: 'Euro with thousands separator' },
  { input: '$1,234', expected: 1234, description: 'Dollar with thousands separator' },
  { input: '1,234', expected: 1234, description: 'Plain thousands separator' },
  { input: '1234', expected: 1234, description: 'Plain number' },
  { input: '10.6', expected: 10.6, description: 'US decimal format' },
  { input: '10,6 900', expected: 106900, description: 'Your specific case' },
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = csvService.parsePrice(testCase.input);
  const success = result === testCase.expected;
  
  if (success) {
    passed++;
    console.log(`✅ Test ${index + 1}: "${testCase.input}" -> ${result} (${testCase.description})`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1}: "${testCase.input}" -> ${result} (expected: ${testCase.expected})`);
    console.log(`   Description: ${testCase.description}`);
  }
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All price parsing tests passed!');
} else {
  console.log('⚠️  Some tests failed. Check the implementation.');
}
