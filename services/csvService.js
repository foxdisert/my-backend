const csv = require('csv-parser');
const fs = require('fs');
const { supabase } = require('../config/database');

class CSVService {
  // Parse CSV file and return parsed data (efficient sampling, select 20 random domains)
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const allResults = [];
      let rowCount = 0;
      const MAX_DOMAINS = 20; // Limit to 20 domains
      const SAMPLE_SIZE = 200; // Only read first 200 rows for efficiency
      let shouldStop = false;
      
      console.log(`📁 Reading CSV file efficiently: ${filePath} (will sample first ${SAMPLE_SIZE} rows and select ${MAX_DOMAINS} domains)`);
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          if (shouldStop) return; // Skip if we should stop
          
          rowCount++;
          
          // Map CSV columns to database fields
          const mappedData = this.mapCSVToDatabase(data);
          if (mappedData) {
            allResults.push(mappedData);
          }
          
          // Stop reading after SAMPLE_SIZE rows for efficiency
          if (rowCount >= SAMPLE_SIZE) {
            console.log(`⏱️  Stopping CSV reading after ${SAMPLE_SIZE} rows for efficiency (not reading all 2,684+ rows)`);
            shouldStop = true; // Mark to stop processing
            return;
          }
          
          // Log progress every 50 rows
          if (rowCount % 50 === 0) {
            console.log(`📊 Processed ${rowCount} rows, found ${allResults.length} valid domains...`);
          }
        })
        .on('end', () => {
          console.log(`📈 CSV reading completed. Total rows processed: ${rowCount}, Total domains found: ${allResults.length}`);
          
          // Randomly select 20 domains from results
          let selectedResults = allResults;
          if (allResults.length > MAX_DOMAINS) {
            console.log(`🎲 Randomly selecting ${MAX_DOMAINS} domains from ${allResults.length} found domains...`);
            
            // Fisher-Yates shuffle algorithm for unbiased random selection
            const shuffled = [...allResults];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            
            selectedResults = shuffled.slice(0, MAX_DOMAINS);
            
            console.log(`🎯 Randomly selected domains from sample:`);
            selectedResults.forEach((domain, index) => {
              console.log(`  ${index + 1}. ${domain.domain} (Price: ${domain.price}, Score: ${domain.score})`);
            });
            
            console.log(`\n📊 SUMMARY:`);
            console.log(`   📁 CSV File: Sampled ${rowCount} rows (not all 2,684+ rows)`);
            console.log(`   🎯 Valid Domains Found: ${allResults.length}`);
            console.log(`   ✅ Domains Selected for Processing: ${selectedResults.length}`);
            console.log(`   ⚡ Only ${selectedResults.length} domains will be checked with GoDaddy API`);
            
          } else if (allResults.length < MAX_DOMAINS) {
            console.log(`⚠️  Only ${allResults.length} domains found, which is less than the maximum ${MAX_DOMAINS}`);
            console.log(`📊 SUMMARY: All ${allResults.length} domains will be processed`);
          } else {
            console.log(`✅ Exactly ${MAX_DOMAINS} domains found, using all of them`);
            console.log(`📊 SUMMARY: All ${MAX_DOMAINS} domains will be processed`);
          }
          
          console.log(`📊 Final selection: ${selectedResults.length}/${MAX_DOMAINS} domains ready for GoDaddy API checks`);
          resolve(selectedResults);
        })
        .on('error', (error) => {
          console.error('❌ CSV parsing error:', error);
          reject(error);
        });
    });
  }

  // Map CSV data to database structure
  mapCSVToDatabase(csvRow) {
    try {
      // Expected CSV format:
      // domain,price,drop_time,crawl_time,extension,tld,length,status
      // homebuilder.co.uk,79,08/23/2025 01:00,08/22/2025 22:00,.co.uk,.co.uk,11,Available Soon
      
      const domain = csvRow.domain?.trim();
      if (!domain) return null;

      // Check if domain is .com (only process .com domains)
      if (!domain.toLowerCase().endsWith('.com')) {
        console.log(`⚠️  Skipping non-.com domain: ${domain} (only .com domains are processed)`);
        return null;
      }

      // Parse price (remove currency symbols, commas)
      const price = this.parsePrice(csvRow.price);
      
      // Parse dates
      const dropTime = this.parseDate(csvRow.drop_time);
      const crawlTime = this.parseDate(csvRow.crawl_time);
      
      // Parse extension and TLD
      const extension = csvRow.extension?.trim() || '';
      const tld = csvRow.tld?.trim() || extension;
      
      // Parse length
      const length = parseInt(csvRow.length) || domain.length;
      
      // Parse status
      const status = csvRow.status?.trim() || 'Available';
      
      // Calculate score based on various factors
      const score = this.calculateScore(domain, price, length, status);

      return {
        domain,
        price,
        extension,
        status,
        score,
        drop_time: dropTime,
        crawl_time: crawlTime,
        tld,
        length
      };
    } catch (error) {
      console.error('Error mapping CSV row:', error);
      return null;
    }
  }

  // Parse price from string
  parsePrice(priceStr) {
    if (!priceStr) return null;
    
    try {
      // Convert to string and trim
      let cleanPrice = priceStr.toString().trim();
      
      // Remove currency symbols
      cleanPrice = cleanPrice.replace(/[$,£€¥]/g, '');
      
      // Handle European number format (comma as decimal separator)
      if (cleanPrice.includes(',')) {
        // If comma is followed by 1-2 digits, it's a decimal separator
        const commaIndex = cleanPrice.indexOf(',');
        const afterComma = cleanPrice.substring(commaIndex + 1);
        
        if (afterComma.length <= 2) {
          // Comma is decimal separator (e.g., "10,6" -> 10.6)
          cleanPrice = cleanPrice.replace(',', '.');
        } else {
          // Comma is thousands separator (e.g., "10,600" -> 10600)
          cleanPrice = cleanPrice.replace(/,/g, '');
        }
      }
      
      // Remove any remaining spaces
      cleanPrice = cleanPrice.replace(/\s/g, '');
      
      // Parse the cleaned price
      const price = parseFloat(cleanPrice);
      
      if (isNaN(price)) {
        console.log(`⚠️  Could not parse price: "${priceStr}" -> cleaned: "${cleanPrice}"`);
        return null;
      }
      
      console.log(`✅ Price parsed: "${priceStr}" -> ${price}`);
      return price;
      
    } catch (error) {
      console.error(`❌ Error parsing price "${priceStr}":`, error);
      return null;
    }
  }

  // Test price parsing with various formats
  testPriceParsing() {
    const testCases = [
      '10,6 900',    // Should be 106900
      '10,600',      // Should be 10600
      '10,6',        // Should be 10.6
      '1,234.56',    // Should be 1234.56
      '1 234,56',    // Should be 1234.56
      '€1,234',      // Should be 1234
      '$1,234',      // Should be 1234
      '1,234',       // Should be 1234
      '1234',        // Should be 1234
      '10.6',        // Should be 10.6
      '10,6 900',    // Should be 106900
    ];
    
    console.log('🧪 Testing price parsing...');
    testCases.forEach(testCase => {
      const result = this.parsePrice(testCase);
      console.log(`"${testCase}" -> ${result}`);
    });
  }

  // Parse date from string
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Handle various date formats
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      
      return date.toISOString();
    } catch (error) {
      return null;
    }
  }

  // Calculate domain score based on various factors (using same logic as estimation page)
  calculateScore(domain, price, length, status) {
    let baseScore = 0;
    
    // Length factor (shorter = more valuable) - same as estimation page
    if (length <= 3) baseScore += 40;
    else if (length <= 5) baseScore += 30;
    else if (length <= 7) baseScore += 20;
    else if (length <= 10) baseScore += 10;
    else baseScore += 5;
    
    // TLD factor - same as estimation page
    const tldScores = {
      'com': 100, 'net': 80, 'org': 75, 'io': 85, 'co': 70,
      'tech': 65, 'app': 70, 'dev': 60, 'ai': 90, 'cloud': 75
    };
    const tld = domain.split('.').pop();
    const tldScore = tldScores[tld] || 50;
    baseScore += (tldScore / 10);
    
    // Keyword factor - same as estimation page
    const premiumKeywords = ['tech', 'digital', 'web', 'app', 'smart', 'cloud', 'data', 'ai', 'cyber', 'future', 'global', 'world', 'hub', 'pro', 'lab', 'studio', 'agency', 'solutions', 'systems', 'works', 'group'];
    const domainName = domain.split('.')[0];
    const keywordScore = premiumKeywords.filter(keyword => 
      domainName.includes(keyword)
    ).length * 15;
    baseScore += keywordScore;
    
    // Brandability factor - same as estimation page
    const brandableScore = this.calculateBrandability(domainName);
    baseScore += brandableScore;
    
    // Market demand factor - same as estimation page
    const marketScore = this.calculateMarketDemand(domainName, tld);
    baseScore += marketScore;
    
    // Price factor (additional from CSV data)
    if (price && price > 1000) baseScore += 20;
    else if (price && price > 500) baseScore += 15;
    else if (price && price > 100) baseScore += 10;
    
    // Status factor (additional from CSV data)
    if (status && status.toLowerCase().includes('premium')) baseScore += 20;
    else if (status && status.toLowerCase().includes('available')) baseScore += 15;
    else if (status && status.toLowerCase().includes('soon')) baseScore += 10;
    
    // Final adjustments - same as estimation page
    baseScore = Math.min(100, Math.max(10, baseScore));
    
    return Math.round(baseScore);
  }

  // Calculate brandability score (same logic as estimation page)
  calculateBrandability(name) {
    let score = 0;
    
    // Check for memorable patterns
    if (/^[aeiou]{2,}/i.test(name)) score += 10; // Starts with vowels
    if (/[aeiou]{3,}/i.test(name)) score += 5;   // Multiple vowels together
    if (/^[bcdfghjklmnpqrstvwxyz]{2,}/i.test(name)) score += 8; // Starts with consonants
    if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(name)) score -= 5;  // Too many consonants
    
    // Check for repetition
    if (/(.)\1{2,}/.test(name)) score -= 10; // Repeated characters
    
    // Check for numbers
    if (/\d/.test(name)) score -= 5;
    
    // Check for hyphens
    if (/-/.test(name)) score -= 8;
    
    return Math.max(-20, Math.min(20, score));
  }

  // Calculate market demand score (same logic as estimation page)
  calculateMarketDemand(name, tld) {
    let score = 0;
    
    // Industry-specific scoring
    if (['tech', 'ai', 'dev', 'app'].includes(tld)) {
      if (['tech', 'digital', 'web', 'app', 'smart', 'cloud', 'data', 'ai', 'cyber'].some(keyword => name.includes(keyword))) {
        score += 20;
      }
    }
    
    if (['io', 'co'].includes(tld)) {
      if (['startup', 'hub', 'pro', 'lab', 'studio', 'agency'].some(keyword => name.includes(keyword))) {
        score += 15;
      }
    }
    
    // Trending keywords
    const trendingKeywords = ['ai', 'ml', 'blockchain', 'crypto', 'nft', 'metaverse', 'web3'];
    if (trendingKeywords.some(keyword => name.includes(keyword))) {
      score += 25;
    }
    
    return Math.min(30, score);
  }

  // Save parsed data to database with GoDaddy API checks (optimized for speed)
  async saveToDatabase(parsedData) {
    try {
      console.log(`💾 Starting fast database save for ${parsedData.length} domains with GoDaddy API checks`);
      
      let inserted = 0;
      let updated = 0;
      let errors = 0;
      let checked = 0;
      
      // Process all domains at once for maximum speed
      console.log(`🚀 Processing ${parsedData.length} domains with GoDaddy API (optimized for speed)`);
      
      for (const data of parsedData) {
        try {
          console.log(`🔍 Processing domain ${checked + 1}/${parsedData.length}: ${data.domain}`);
          checked++;
          
          // Check domain availability using GoDaddy API
          console.log(`🌐 Checking GoDaddy API for: ${data.domain}`);
          const availability = await this.checkDomainAvailability(data.domain);
          
          if (availability) {
            // Update data with GoDaddy API results
            data.status = availability.status;
            data.price = availability.price || data.price;
            data.available = availability.available;
            
            console.log(`✅ GoDaddy API result for ${data.domain}: ${availability.status} - $${availability.price}`);
            
            // Calculate enhanced score
            data.score = this.calculateEnhancedScore(data.domain, data.price, data.length, data.status, availability);
            console.log(`💰 Enhanced score for ${data.domain}: ${data.score}/100`);
            
                         // Calculate estimation price using estimation page logic
             const estimationPrice = this.calculateEstimatedValue(data.domain, data.score, data.length, data.extension);
             data.estimation_price = estimationPrice;
             
             console.log(`🎯 Estimation price for ${data.domain}: $${estimationPrice} (using estimation page logic)`);
             console.log(`   Raw price: $${data.price}, Score: ${data.score}/100, Length: ${data.length}, TLD: ${data.extension}`);
          } else {
            console.log(`⚠️  GoDaddy API check failed for ${data.domain}, using default values`);
            data.status = data.status || 'Unknown';
            data.available = false;
            
                         // Calculate estimation price even without GoDaddy data
             const estimationPrice = this.calculateEstimatedValue(data.domain, data.score, data.length, data.extension);
             data.estimation_price = estimationPrice;
             
             console.log(`🎯 Estimation price for ${data.domain}: $${estimationPrice} (using estimation page logic)`);
             console.log(`   Raw price: $${data.price}, Score: ${data.score}/100, Length: ${data.length}, TLD: ${data.extension}`);
          }
          
          // Check if domain already exists
          const { data: existing, error: checkError } = await supabase
            .from('suggested_domains')
            .select('id')
            .eq('domain', data.domain)
            .limit(1);
          
          if (checkError) {
            console.error('❌ Error checking existing domain:', checkError);
            errors++;
            continue;
          }
          
          if (existing && existing.length > 0) {
            // Update existing record
            console.log(`🔄 Updating existing domain: ${data.domain}`);
            const { error: updateError } = await supabase
              .from('suggested_domains')
              .update({
                price: data.price,
                estimation_price: data.estimation_price,
                extension: data.extension,
                status: data.status,
                score: data.score,
                drop_time: data.drop_time,
                crawl_time: data.crawl_time,
                tld: data.tld,
                length: data.length,
                available: data.available
              })
              .eq('domain', data.domain);
            
            if (updateError) {
              console.error('❌ Error updating domain:', updateError);
              errors++;
            } else {
              updated++;
              console.log(`✅ Updated domain: ${data.domain}`);
            }
          } else {
            // Insert new record
            console.log(`➕ Inserting new domain: ${data.domain}`);
            const { error: insertError } = await supabase
              .from('suggested_domains')
              .insert([{
                ...data,
                available: data.available || false
              }]);
            
            if (insertError) {
              console.error(`❌ Error inserting domain: ${data.domain}:`, insertError);
              errors++;
            } else {
              inserted++;
              console.log(`✅ Inserted domain: ${data.domain}`);
            }
          }
          
          // Minimal delay between API calls (reduced from 200ms to 100ms for maximum speed)
          if (checked < parsedData.length) {
            console.log(`⏳ Quick delay (100ms) before next API call...`);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (rowError) {
          console.error(`❌ Error processing domain ${data.domain}:`, rowError);
          errors++;
        }
      }
      
      console.log(`📊 Fast database save completed! Checked: ${checked}, Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`);
      return { checked, inserted, updated, total: parsedData.length, errors };
    } catch (error) {
      console.error('💥 Fatal error in saveToDatabase:', error);
      throw error;
    }
  }

  // Process CSV file and save to database
  async processCSV(filePath) {
    const startTime = Date.now();
    try {
      console.log(`\n🚀 Starting CSV processing workflow...`);
      console.log(`📁 File: ${filePath}`);
      console.log(`⏱️  Start time: ${new Date().toLocaleTimeString()}`);
      console.log(`\n📋 WORKFLOW EXPLANATION:`);
      console.log(`   1️⃣ Read first 200 rows of CSV file (efficient sampling)`);
      console.log(`   2️⃣ Filter for .com domains only (skip other TLDs)`);
      console.log(`   3️⃣ Find valid .com domains in those rows`);
      console.log(`   4️⃣ Randomly select ONLY 20 .com domains`);
      console.log(`   5️⃣ Check those 20 domains with GoDaddy API`);
      console.log(`   6️⃣ Save the 20 domains to database`);
      
      // Step 1: Efficiently parse CSV and select 20 random .com domains
      console.log(`\n📊 Step 1: Efficiently reading CSV file and selecting 20 random .com domains...`);
      const step1Start = Date.now();
      const parsedData = await this.parseCSV(filePath);
      const step1Time = Date.now() - step1Start;
      console.log(`✅ Step 1 completed in ${step1Time}ms: ${parsedData.length} .com domains selected from sample`);
      
      // Step 2: Check GoDaddy API and save to database
      console.log(`\n🌐 Step 2: Checking GoDaddy API for ONLY ${parsedData.length} domains and saving to database...`);
      const step2Start = Date.now();
      const result = await this.saveToDatabase(parsedData);
      const step2Time = Date.now() - step2Start;
      console.log(`✅ Step 2 completed in ${step2Time}ms: ${result.checked} domains processed`);
      
      // Step 3: Cleanup
      console.log(`\n🧹 Step 3: Cleaning up temporary files...`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Temporary file removed: ${filePath}`);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`\n🎉 CSV processing workflow finished successfully!`);
      console.log(`⏱️  Total time: ${totalTime}ms (${(totalTime/1000).toFixed(1)} seconds)`);
      console.log(`📊 Final Results: ${result.checked} .com domains checked, ${result.inserted} inserted, ${result.updated} updated, ${result.errors} errors`);
      console.log(`🚀 Performance: ${(result.checked/(totalTime/1000)).toFixed(1)} .com domains per second`);
      console.log(`\n💡 REMEMBER: Only ${result.checked} .com domains were processed from a sample of the CSV file!`);
      
      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`💥 Fatal error in CSV processing workflow after ${totalTime}ms:`, error);
      
      // Clean up temporary file on error
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`✅ Temporary file cleaned up after error: ${filePath}`);
        } catch (cleanupError) {
          console.error('❌ Error cleaning up temporary file:', cleanupError);
        }
      }
      
      throw error;
    }
  }

  // Check domain availability using GoDaddy API
  async checkDomainAvailability(domain) {
    try {
      console.log(`🌐 Checking GoDaddy API for domain: ${domain}`);
      
      // Import GoDaddy service
      const godaddyService = require('./godaddyService');
      
      // Check domain availability
      const availability = await godaddyService.checkDomainAvailability(domain);
      
      if (availability) {
        console.log(`✅ GoDaddy API response for ${domain}:`, availability);
        return {
          available: availability.available || false,
          status: availability.status || 'Unknown',
          price: availability.price || null,
          currency: availability.currency || 'USD'
        };
      } else {
        console.log(`⚠️  No GoDaddy API response for ${domain}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ GoDaddy API error for ${domain}:`, error);
      return null;
    }
  }

  // Calculate enhanced score using GoDaddy data and other factors (using same logic as estimation page)
  calculateEnhancedScore(domain, price, length, status, availability) {
    let baseScore = 0;
    
    // Length factor (shorter = more valuable) - same as estimation page
    if (length <= 3) baseScore += 40;
    else if (length <= 5) baseScore += 30;
    else if (length <= 7) baseScore += 20;
    else if (length <= 10) baseScore += 10;
    else baseScore += 5;
    
    // TLD factor - same as estimation page
    const tldScores = {
      'com': 100, 'net': 80, 'org': 75, 'io': 85, 'co': 70,
      'tech': 65, 'app': 70, 'dev': 60, 'ai': 90, 'cloud': 75
    };
    const tld = domain.split('.').pop();
    const tldScore = tldScores[tld] || 50;
    baseScore += (tldScore / 10);
    
    // Keyword factor - same as estimation page
    const premiumKeywords = ['tech', 'digital', 'web', 'app', 'smart', 'cloud', 'data', 'ai', 'cyber', 'future', 'global', 'world', 'hub', 'pro', 'lab', 'studio', 'agency', 'solutions', 'systems', 'works', 'group'];
    const domainName = domain.split('.')[0];
    const keywordScore = premiumKeywords.filter(keyword => 
      domainName.includes(keyword)
    ).length * 15;
    baseScore += keywordScore;
    
    // Brandability factor - same as estimation page
    const brandableScore = this.calculateBrandability(domainName);
    baseScore += brandableScore;
    
    // Market demand factor - same as estimation page
    const marketScore = this.calculateMarketDemand(domainName, tld);
    baseScore += marketScore;
    
    // Price factor from GoDaddy API (higher prices get higher scores)
    if (price && price > 1000) baseScore += 25;
    else if (price && price > 500) baseScore += 20;
    else if (price && price > 100) baseScore += 15;
    else if (price && price > 50) baseScore += 10;
    
    // Availability factor from GoDaddy API
    if (availability && availability.available) {
      baseScore += 15; // Available domains get bonus points
      if (availability.status === 'Available') baseScore += 10;
      else if (availability.status === 'Available Soon') baseScore += 5;
    }
    
    // Status factor (additional from CSV data)
    if (status && status.toLowerCase().includes('premium')) baseScore += 20;
    else if (status && status.toLowerCase().includes('available')) baseScore += 15;
    else if (status && status.toLowerCase().includes('soon')) baseScore += 10;
    
    // Final adjustments - same as estimation page
    baseScore = Math.min(100, Math.max(10, baseScore));
    
    return Math.round(baseScore);
  }

  // Calculate estimated price based on domain, score, length, and extension (using same logic as estimation page)
  calculateEstimatedValue(domain, score, length, extension) {
    const tld = extension || domain.split('.').pop(); // Get TLD from domain or extension
    
    let baseValue = 0;
    
    // Base value by TLD (same as estimation page)
    const tldBaseValues = {
      'com': 1000, 'net': 800, 'org': 750, 'io': 1200, 'co': 900,
      'tech': 600, 'app': 700, 'dev': 500, 'ai': 1500, 'cloud': 800
    };
    baseValue = tldBaseValues[tld] || 500;
    
    // Adjust by score (same as estimation page)
    const scoreMultiplier = score / 50; // 0.2 to 2.0
    
    // Adjust by length (same as estimation page)
    const lengthMultiplier = length <= 3 ? 3 : length <= 5 ? 2 : length <= 7 ? 1.5 : length <= 10 ? 1.2 : 1;
    
    let estimatedValue = baseValue * scoreMultiplier * lengthMultiplier;
    
    // Round to reasonable ranges (same as estimation page)
    if (estimatedValue < 100) estimatedValue = Math.round(estimatedValue / 10) * 10;
    else if (estimatedValue < 1000) estimatedValue = Math.round(estimatedValue / 50) * 50;
    else if (estimatedValue < 10000) estimatedValue = Math.round(estimatedValue / 100) * 100;
    else estimatedValue = Math.round(estimatedValue / 1000) * 1000;
    
    return estimatedValue;
  }
}

module.exports = new CSVService();
