// Test database connection and table existence
const { supabase, testConnection, initDatabase } = require('./config/database');

async function testDatabase() {
  console.log('🧪 Testing Database Connection...\n');
  
  try {
    // Test connection
    console.log('1️⃣ Testing Supabase connection...');
    await testConnection();
    
    // Test table existence
    console.log('\n2️⃣ Testing table existence...');
    
    // Test suggested_domains table
    console.log('   📊 Testing suggested_domains table...');
    const { data: domains, error: domainsError } = await supabase
      .from('suggested_domains')
      .select('*')
      .limit(1);
    
    if (domainsError) {
      console.log(`   ❌ suggested_domains table error: ${domainsError.message}`);
      if (domainsError.code === '42P01') {
        console.log('   ⚠️  Table does not exist! Need to create it.');
      }
    } else {
      console.log(`   ✅ suggested_domains table exists with ${domains?.length || 0} records`);
    }
    
    // Test inserting a sample domain
    console.log('\n3️⃣ Testing domain insertion...');
    const testDomain = {
      domain: 'test-insert.com',
      price: 100,
      extension: '.com',
      status: 'Available',
      score: 75,
      drop_time: new Date().toISOString(),
      crawl_time: new Date().toISOString(),
      tld: '.com',
      length: 12,
      available: true
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('suggested_domains')
      .insert([testDomain])
      .select();
    
    if (insertError) {
      console.log(`   ❌ Insert failed: ${insertError.message}`);
      console.log(`   🔍 Error details:`, insertError);
    } else {
      console.log(`   ✅ Insert successful: ${insertData[0].domain}`);
      
      // Clean up test data
      const { error: deleteError } = await supabase
        .from('suggested_domains')
        .delete()
        .eq('domain', 'test-insert.com');
      
      if (deleteError) {
        console.log(`   ⚠️  Cleanup failed: ${deleteError.message}`);
      } else {
        console.log('   🧹 Test data cleaned up');
      }
    }
    
    // Check table structure
    console.log('\n4️⃣ Checking table structure...');
    const { data: structure, error: structureError } = await supabase
      .from('suggested_domains')
      .select('*')
      .limit(0);
    
    if (structureError) {
      console.log(`   ❌ Structure check failed: ${structureError.message}`);
    } else {
      console.log('   ✅ Table structure accessible');
    }
    
  } catch (error) {
    console.error('💥 Database test failed:', error);
  }
}

testDatabase();
