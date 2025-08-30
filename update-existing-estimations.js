const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Calculate estimated price based on domain, score, length, and extension
function calculateEstimatedValue(domain, score, length, extension) {
  let basePrice = 0;
  const tld = extension || domain.split('.').pop(); // Get TLD from domain or extension

  // Base price based on TLD
  if (tld === 'com') basePrice = 100;
  else if (tld === 'io' || tld === 'co') basePrice = 80;
  else if (tld === 'net' || tld === 'org') basePrice = 50;
  else if (tld === 'uk' || tld === 'de') basePrice = 60;
  else basePrice = 50; // Default for other TLDs

  // Length factor (shorter domains get higher prices)
  if (length <= 5) basePrice += 50;
  else if (length <= 8) basePrice += 30;
  else if (length <= 12) basePrice += 20;
  else if (length > 20) basePrice -= 10;

  // Score factor (higher scores get higher prices)
  if (score >= 80) basePrice += 20;
  else if (score >= 60) basePrice += 15;
  else if (score >= 40) basePrice += 10;
  else if (score >= 20) basePrice += 5;

  // Brandable factor (no numbers, no hyphens)
  if (!/\d/.test(domain) && !domain.includes('-')) basePrice += 10;

  // Domain quality factors (lower scores reduce price)
  if (score < 50) basePrice -= 10;
  if (score < 30) basePrice -= 5;

  return Math.max(0, Math.round(basePrice)); // Ensure price is not negative
}

async function updateExistingEstimations() {
  try {
    console.log('🔄 Starting to update existing domains with estimation prices...');
    
    // Get all domains that don't have estimation_price
    const { data: domains, error: fetchError } = await supabase
      .from('suggested_domains')
      .select('id, domain, price, score, length, extension, tld')
      .or('estimation_price.is.null,estimation_price.eq.0');
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`📊 Found ${domains?.length || 0} domains that need estimation prices`);
    
    if (!domains || domains.length === 0) {
      console.log('✅ All domains already have estimation prices!');
      return;
    }
    
    let updated = 0;
    let errors = 0;
    
    for (const domain of domains) {
      try {
        // Calculate estimation price
        const estimationPrice = calculateEstimatedValue(
          domain.domain, 
          domain.score || 50, 
          domain.length || domain.domain.length, 
          domain.extension || domain.tld
        );
        
        console.log(`🎯 ${domain.domain}: Raw price $${domain.price}, Score ${domain.score}, Estimation: $${estimationPrice}`);
        
        // Update the domain with estimation price
        const { error: updateError } = await supabase
          .from('suggested_domains')
          .update({ estimation_price: estimationPrice })
          .eq('id', domain.id);
        
        if (updateError) {
          console.error(`❌ Error updating ${domain.domain}:`, updateError);
          errors++;
        } else {
          updated++;
          console.log(`✅ Updated ${domain.domain} with estimation price $${estimationPrice}`);
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (domainError) {
        console.error(`❌ Error processing ${domain.domain}:`, domainError);
        errors++;
      }
    }
    
    console.log(`\n🎉 Update completed!`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📊 Total processed: ${domains.length}`);
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
}

// Run the update
updateExistingEstimations();
