/**
 * Simple test runner to verify currency formatting without external dependencies
 */

// Import the safeFormatCurrency function
const { safeFormatCurrency } = require('../utils/currency');

// Test scenarios
const testScenarios = [
  { input: 0, expected: '$0.00', description: 'Zero value' },
  { input: 10, expected: '$10.00', description: 'Positive integer' },
  { input: 99.99, expected: '$99.99', description: 'Positive decimal' },
  { input: 1000.5, expected: '$1000.50', description: 'Large number with one decimal' },
  { input: null, expected: '$0.00', description: 'Null value' },
  { input: undefined, expected: '$0.00', description: 'Undefined value' },
  { input: '', expected: '$0.00', description: 'Empty string' },
  { input: 'not-a-number', expected: '$0.00', description: 'Non-numeric string' },
  { input: NaN, expected: '$0.00', description: 'NaN value' },
  { input: Infinity, expected: '$0.00', description: 'Infinity value' },
  { input: -Infinity, expected: '$0.00', description: 'Negative infinity' },
  { input: -10, expected: '$0.00', description: 'Negative number (using fallback 0)' },
  { input: '123.45', expected: '$123.45', description: 'String number' },
];

function runTests() {
  console.log('🧮 Running Currency Formatting Tests...\n');

  let passed = 0;
  let failed = 0;

  testScenarios.forEach((scenario, index) => {
    try {
      const actual = safeFormatCurrency(scenario.input);
      const passedTest = actual === scenario.expected;

      if (passedTest) {
        passed++;
        console.log(`✅ Test ${index + 1}: ${scenario.description}`);
        console.log(`   Input: ${scenario.input} → Output: ${actual}`);
      } else {
        failed++;
        console.log(`❌ Test ${index + 1}: ${scenario.description}`);
        console.log(`   Input: ${scenario.input}`);
        console.log(`   Expected: ${scenario.expected}`);
        console.log(`   Actual: ${actual}`);
      }
      console.log('');
    } catch (error) {
      failed++;
      console.log(`❌ Test ${index + 1}: ${scenario.description}`);
      console.log(`   Input: ${scenario.input}`);
      console.log(`   Error: ${error}`);
      console.log('');
    }
  });

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All currency formatting tests passed!');
  } else {
    console.log('⚠️ Some tests failed. Please review the errors above.');
  }

  return { passed, failed, total: passed + failed };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests, testScenarios };