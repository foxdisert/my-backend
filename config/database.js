const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create Supabase client with anon key for regular operations
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Test database connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Supabase connected successfully');
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    process.exit(1);
  }
};

// Initialize database tables if they don't exist
const initDatabase = async () => {
  try {
    // Note: In Supabase, tables are typically created through migrations or the dashboard
    // This function will check if tables exist and create them if needed
    
    // Check if users table exists by trying to query it
    let { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError && usersError.code === '42P01') { // Table doesn't exist
      console.log('⚠️ Users table not found. Please create it in Supabase dashboard or run migrations.');
    }
    
    // Check if checked_domains table exists
    let { data: domains, error: domainsError } = await supabase
      .from('checked_domains')
      .select('id')
      .limit(1);
    
    if (domainsError && domainsError.code === '42P01') {
      console.log('⚠️ Checked_domains table not found. Please create it in Supabase dashboard or run migrations.');
    }
    
    // Check if favorites table exists
    let { data: favorites, error: favoritesError } = await supabase
      .from('favorites')
      .select('id')
      .limit(1);
    
    if (favoritesError && favoritesError.code === '42P01') {
      console.log('⚠️ Favorites table not found. Please create it in Supabase dashboard or run migrations.');
    }
    
    // Check if suggested_domains table exists
    let { data: suggestions, error: suggestionsError } = await supabase
      .from('suggested_domains')
      .select('id')
      .limit(1);
    
    if (suggestionsError && suggestionsError.code === '42P01') {
      console.log('⚠️ Suggested_domains table not found. Please create it in Supabase dashboard or run migrations.');
    }

    // Check if admin user exists, if not create one
    const { data: adminUsers, error: adminCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);
    
    if (!adminCheckError && adminUsers && adminUsers.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const { error: adminCreateError } = await supabase
        .from('users')
        .insert([
          {
            name: 'Admin User',
            email: 'admin@domainchecker.com',
            password_hash: hashedPassword,
            role: 'admin'
          }
        ]);
      
      if (adminCreateError) {
        console.error('❌ Failed to create admin user:', adminCreateError.message);
      } else {
      console.log('✅ Admin user created (email: admin@domainchecker.com, password: admin123)');
      }
    }

    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

module.exports = {
  supabase,
  supabaseAnon,
  testConnection,
  initDatabase
};
