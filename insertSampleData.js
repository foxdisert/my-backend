const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'domain_checker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const sampleSuggestions = [
  {
    domain: 'techhub.com',
    price: 1299.99,
    extension: 'com',
    status: 'Available',
    score: 95,
    tld: 'com',
    length: 7,
    description: 'Premium tech domain perfect for technology companies and startups',
    category: 'Technology'
  },
  {
    domain: 'digitalpro.net',
    price: 899.99,
    extension: 'net',
    status: 'Available',
    score: 88,
    tld: 'net',
    length: 10,
    description: 'Professional digital services domain with strong branding potential',
    category: 'Digital Services'
  },
  {
    domain: 'webstudio.io',
    price: 1499.99,
    extension: 'io',
    status: 'Available',
    score: 92,
    tld: 'io',
    length: 9,
    description: 'Modern .io domain ideal for web development studios and tech companies',
    category: 'Technology'
  },
  {
    domain: 'smartcloud.ai',
    price: 2499.99,
    extension: 'ai',
    status: 'Available',
    score: 96,
    tld: 'ai',
    length: 10,
    description: 'Premium AI domain perfect for artificial intelligence and cloud services',
    category: 'AI & Cloud'
  },
  {
    domain: 'futurelab.co',
    price: 799.99,
    extension: 'co',
    status: 'Available',
    score: 85,
    tld: 'co',
    length: 9,
    description: 'Innovative .co domain for research labs and future-focused companies',
    category: 'Innovation'
  },
  {
    domain: 'cybertech.dev',
    price: 1199.99,
    extension: 'dev',
    status: 'Available',
    score: 90,
    tld: 'dev',
    length: 10,
    description: 'Developer-focused domain for cybersecurity and technology companies',
    category: 'Cybersecurity'
  }
];

async function insertSampleData() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Check if suggestions table exists and has data
    const [existing] = await connection.execute('SELECT COUNT(*) as count FROM suggested_domains');
    
    if (existing[0].count > 0) {
      console.log('⚠️  Database already has suggestions, skipping insertion');
      return;
    }

    // Insert sample suggestions
    for (const suggestion of sampleSuggestions) {
      await connection.execute(`
        INSERT INTO suggested_domains 
        (domain, price, extension, status, score, tld, length, description, category) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        suggestion.domain,
        suggestion.price,
        suggestion.extension,
        suggestion.status,
        suggestion.score,
        suggestion.tld,
        suggestion.length,
        suggestion.description,
        suggestion.category
      ]);
      console.log(`✅ Inserted: ${suggestion.domain}`);
    }

    console.log('🎉 Sample data inserted successfully!');

  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
insertSampleData();
