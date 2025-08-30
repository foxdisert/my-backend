const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testEstimationPrice() {
  try {
    console.log('🧪 Testing estimation_price field...');
    
    // Test 1: Check if the column exists
    console.log('\n📊 Test 1: Checking if estimation_price column exists...');
    const { data: columns, error: columnError } = await supabase
      .from('suggested_domains')
      .select('*')
      .limit(1);
    
    if (columnError) {
      console.error('❌ Error accessing table:', columnError);
      return;
    }
    
    if (columns && columns.length > 0) {
      const sample = columns[0];
      console.log('✅ Table accessible');
      console.log('📋 Available fields:', Object.keys(sample));
      
      if ('estimation_price' in sample) {
        console.log('✅ estimation_price field exists!');
        console.log('💰 Sample estimation_price:', sample.estimation_price);
      } else {
        console.log('❌ estimation_price field missing!');
        console.log('💡 You need to run the SQL script to add this column');
        return;
      }
    }
    
    // Test 2: Check a few domains
    console.log('\n📊 Test 2: Checking sample domains...');
    const { data: domains, error: fetchError } = await supabase
      .from('suggested_domains')
      .select('domain, price, estimation_price, score, length, extension')
      .limit(5);
    
    if (fetchError) {
      console.error('❌ Error fetching domains:', fetchError);
      return;
    }
    
    if (domains && domains.length > 0) {
      console.log(`✅ Found ${domains.length} domains:`);
      domains.forEach((domain, index) => {
        console.log(`\n  ${index + 1}. ${domain.domain}`);
        console.log(`     Raw Price: $${domain.price || 'N/A'}`);
        console.log(`     Est. Price: $${domain.estimation_price || 'N/A'}`);
        console.log(`     Score: ${domain.score || 'N/A'}`);
        console.log(`     Length: ${domain.length || 'N/A'}`);
        console.log(`     Extension: ${domain.extension || 'N/A'}`);
      });
    }
    
    // Test 3: Check if we have domains with different prices
    console.log('\n📊 Test 3: Checking price differences...');
    const { data: priceDiff, error: diffError } = await supabase
      .from('suggested_domains')
      .select('domain, price, estimation_price')
      .not('estimation_price', 'is', null)
      .not('price', 'is', null)
      .limit(3);
    
    if (diffError) {
      console.error('❌ Error checking price differences:', diffError);
      return;
    }
    
    if (priceDiff && priceDiff.length > 0) {
      console.log('✅ Domains with both prices:');
      priceDiff.forEach((domain, index) => {
        const diff = Math.abs(domain.price - domain.estimation_price);
        const percentDiff = ((diff / domain.price) * 100).toFixed(1);
        console.log(`\n  ${index + 1}. ${domain.domain}`);
        console.log(`     Raw: $${domain.price.toLocaleString()}`);
        console.log(`     Est: $${domain.estimation_price.toLocaleString()}`);
        console.log(`     Diff: $${diff.toLocaleString()} (${percentDiff}%)`);
      });
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
}

// Run the test
testEstimationPrice();
