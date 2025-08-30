// Test script to demonstrate CSV workflow
const csvService = require('./services/csvService');

console.log('🧪 Testing CSV Workflow...\n');

// Create a sample CSV file for testing
const fs = require('fs');
const testCSV = 'test-domains.csv';

// Create a test CSV with 100 domains
let csvContent = 'domain,price,drop_time,crawl_time,extension,tld,length,status\n';
for (let i = 1; i <= 100; i++) {
  csvContent += `testdomain${i}.com,${100 + i},08/23/2025 01:00,08/22/2025 22:00,.com,.com,${12 + i},Available\n`;
}

fs.writeFileSync(testCSV, csvContent);
console.log(`📁 Created test CSV with 100 domains`);

// Test the workflow
async function testWorkflow() {
  try {
    console.log('\n🚀 Testing CSV processing workflow...\n');
    
    const result = await csvService.processCSV(testCSV);
    
    console.log('\n✅ Test completed successfully!');
    console.log(`📊 Result: ${result.checked} domains processed out of 100 total domains`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    if (fs.existsSync(testCSV)) {
      fs.unlinkSync(testCSV);
      console.log('🧹 Test file cleaned up');
    }
  }
}

testWorkflow();
