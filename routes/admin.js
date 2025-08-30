const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { strictLimiter } = require('../middleware/rateLimit');
const { supabase } = require('../config/database');
const csvService = require('../services/csvService');

const router = express.Router();

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'csv-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit
  }
});

// Upload CSV file with domain suggestions
router.post('/suggestions/upload', 
  authenticateToken, 
  requireAdmin, 
  strictLimiter,
  upload.single('csv'), 
  async (req, res) => {
    try {
      console.log('📤 CSV upload request received');
      
      if (!req.file) {
        console.log('❌ No CSV file provided');
        return res.status(400).json({ error: 'CSV file is required' });
      }

      console.log('📁 File details:', {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // Process the CSV file
      console.log('🔄 Starting CSV processing...');
      
      // Set response headers for streaming progress
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Send initial progress
      res.write(JSON.stringify({
        type: 'progress',
        message: 'Starting CSV processing...',
        progress: 0,
        total: 20
      }) + '\n');
      
      const result = await csvService.processCSV(req.file.path);
      
      console.log('✅ CSV processing completed:', result);

      // Send final result
      res.write(JSON.stringify({
        type: 'complete',
        message: 'CSV processed successfully',
        result,
        progress: 100,
        total: 20
      }) + '\n');
      
      res.end();

    } catch (error) {
      console.error('❌ CSV upload error:', error);
      
      if (error.message.includes('CSV')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to process CSV file' });
      }
    }
  }
);

// Get all suggested domains (admin view)
router.get('/suggestions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', sortBy = 'score', sortOrder = 'desc' } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = supabase
      .from('suggested_domains')
      .select('id, domain, price, estimation_price, extension, status, score, description, category, drop_time, crawl_time, tld, length, created_at', { count: 'exact' });
    
    if (search) {
      query = query.or(`domain.ilike.%${search}%,status.ilike.%${search}%`);
    }
    
    // Get domains with pagination
    const { data: domains, error: fetchError, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    if (fetchError) {
      throw fetchError;
    }

    res.json({
      domains: domains || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get admin suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggested domains' });
  }
});

// Create new suggested domain
router.post('/suggestions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { domain, price, estimation_price, extension, status, score, description, category, length } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Extract TLD from domain if not provided
    const domainParts = domain.split('.');
    const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : extension || 'com';
    const domainLength = length || domain.length;

    const { error: insertError } = await supabase
      .from('suggested_domains')
      .insert([
        {
          domain,
          price: price || 0,
          estimation_price: estimation_price || price || 0,
          extension: extension || tld,
          status: status || 'Available',
          score: score || 50,
          description: description || '',
          category: category || 'Generated',
          tld,
          length: domainLength
        }
      ]);

    if (insertError) {
      throw insertError;
    }

    res.json({ message: 'Domain suggestion created successfully' });

  } catch (error) {
    console.error('Create suggestion error:', error);
    res.status(500).json({ error: 'Failed to create domain suggestion' });
  }
});

// Update suggested domain
router.put('/suggestions/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { domain, price, estimation_price, extension, status, score, drop_time, crawl_time, tld, length } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const { error: updateError } = await supabase
      .from('suggested_domains')
      .update({
        domain,
        price,
        estimation_price,
        extension,
        status,
        score,
        drop_time,
        crawl_time,
        tld,
        length
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    res.json({ message: 'Domain updated successfully' });

  } catch (error) {
    console.error('Update suggestion error:', error);
    res.status(500).json({ error: 'Failed to update domain' });
  }
});

// Delete suggested domain
router.delete('/suggestions/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: result, error: deleteError } = await supabase
      .from('suggested_domains')
      .delete()
      .eq('id', id)
      .select();

    if (deleteError) {
      throw deleteError;
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    res.json({ message: 'Domain deleted successfully' });

  } catch (error) {
    console.error('Delete suggestion error:', error);
    res.status(500).json({ error: 'Failed to delete domain' });
  }
});

// Get dashboard statistics
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get counts for different entities
    const [
      { count: totalUsers },
      { count: totalSuggestions },
      { count: totalChecks },
      { count: totalFavorites }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('suggested_domains').select('*', { count: 'exact', head: true }),
      supabase.from('checked_domains').select('*', { count: 'exact', head: true }),
      supabase.from('favorites').select('*', { count: 'exact', head: true })
    ]);

    res.json({
      stats: {
        totalUsers: totalUsers || 0,
        totalSuggestions: totalSuggestions || 0,
        totalChecks: totalChecks || 0,
        totalFavorites: totalFavorites || 0
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// ==================== USER MANAGEMENT ENDPOINTS ====================

// Get all users with pagination and search
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', role = '', status = '', sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = supabase
      .from('users')
      .select('id, name, email, role, status, created_at', { count: 'exact' });
    
    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    
    if (role) {
      query = query.eq('role', role);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // Get users with pagination
    const { data: users, error: fetchError, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    if (fetchError) {
      throw fetchError;
    }

    res.json({
      users: users || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user by ID
router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, status, created_at')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'User not found' });
      }
      throw error;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, role = 'user', status = 'active' } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    // Generate a temporary password hash (in production, you'd want to generate a random password)
    const bcrypt = require('bcryptjs');
    const tempPassword = 'temporary123'; // In production, generate random password
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    // Create new user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        name: name || null,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: role,
        status: status,
        created_at: new Date().toISOString()
      }])
      .select('id, name, email, role, status, created_at')
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ 
      message: 'User created successfully',
      user: newUser,
      tempPassword: tempPassword // Return temporary password for admin to share with user
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', id)
      .single();
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent updating admin users (except by super admin)
    if (existingUser.role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify admin users' });
    }
    
    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    
    // Update user
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, name, email, role, status, created_at')
      .single();

    if (error) {
      throw error;
    }

    res.json({ 
      message: 'User updated successfully',
      user: updatedUser 
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', id)
      .single();
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deleting admin users
    if (existingUser.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin users' });
    }
    
    // Prevent deleting self
    if (parseInt(id) === req.user.id) {
      return res.status(403).json({ error: 'Cannot delete yourself' });
    }
    
    // Delete user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Toggle user status (activate/suspend)
router.patch('/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "active" or "suspended"' });
    }
    
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', id)
      .single();
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent suspending admin users
    if (existingUser.role === 'admin' && status === 'suspended') {
      return res.status(403).json({ error: 'Cannot suspend admin users' });
    }
    
    // Update user status
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', id)
      .select('id, name, email, role, status, created_at')
      .single();

    if (error) {
      throw error;
    }

    res.json({ 
      message: `User ${status === 'active' ? 'activated' : 'suspended'} successfully`,
      user: updatedUser 
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Bulk user operations
router.post('/users/bulk', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, userIds, data } = req.body;
    
    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Invalid bulk operation parameters' });
    }
    
    let result;
    
    switch (action) {
      case 'activate':
        result = await supabase
          .from('users')
          .update({ status: 'active' })
          .in('id', userIds)
          .neq('role', 'admin'); // Don't affect admin users
        break;
        
      case 'suspend':
        result = await supabase
          .from('users')
          .update({ status: 'suspended' })
          .in('id', userIds)
          .neq('role', 'admin'); // Don't affect admin users
        break;
        
      case 'delete':
        result = await supabase
          .from('users')
          .delete()
          .in('id', userIds)
          .neq('role', 'admin'); // Don't affect admin users
        break;
        
      case 'change_role':
        if (!data || !data.role) {
          return res.status(400).json({ error: 'Role is required for role change operation' });
        }
        result = await supabase
          .from('users')
          .update({ role: data.role })
          .in('id', userIds)
          .neq('role', 'admin'); // Don't affect admin users
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    if (result.error) {
      throw result.error;
    }
    
    res.json({ 
      message: `Bulk operation "${action}" completed successfully`,
      affectedUsers: result.count || 0
    });
  } catch (error) {
    console.error('Bulk user operation error:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

// Get user activity logs
router.get('/users/:id/activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get user's domain checks
    const { data: checks, error: checksError } = await supabase
      .from('checked_domains')
      .select('domain, status, checked_at')
      .eq('user_id', id)
      .order('checked_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    
    if (checksError) {
      throw checksError;
    }
    
    // Get user's favorites
    const { data: favorites, error: favoritesError } = await supabase
      .from('favorites')
      .select('domain, added_at')
      .eq('user_id', id)
      .order('added_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    
    if (favoritesError) {
      throw favoritesError;
    }
    
    res.json({
      checks: checks || [],
      favorites: favorites || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// Website Configuration Routes
router.get('/website-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('📋 Fetching website configuration...');
    
    const { data, error } = await supabase
      .from('website_config')
      .select('*')
      .order('id', { ascending: true })
      .limit(1);
    
    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch website configuration' });
    }
    
    if (data && data.length > 0) {
      const config = data[0];
      console.log('✅ Website configuration fetched:', config);
      res.json(config);
    } else {
      // Return default configuration if none exists
      const defaultConfig = {
        site_title: 'Domain Toolkit',
        site_description: 'Professional domain management and analysis tools',
        logo: '',
        favicon: '',
        contact_email: 'admin@domaintoolkit.com',
        contact_phone: '+1 (555) 123-4567',
        social_links: {},
        language: 'en',
        timezone: 'UTC',
        currency: 'USD',
        maintenance_mode: false
      };
      console.log('📋 Returning default configuration');
      res.json(defaultConfig);
    }
    
  } catch (error) {
    console.error('❌ Website config fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/website-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('💾 Saving website configuration...');
    const configData = req.body;
    
    // Validate required fields
    if (!configData.site_title || !configData.contact_email) {
      return res.status(400).json({ error: 'Site title and contact email are required' });
    }
    
    // Check if configuration already exists
    const { data: existingConfig } = await supabase
      .from('website_config')
      .select('id')
      .order('id', { ascending: true })
      .limit(1);
    
    let result;
    
    if (existingConfig && existingConfig.length > 0) {
      // Update existing configuration
      const { data, error } = await supabase
        .from('website_config')
        .update({
          site_title: configData.site_title,
          site_description: configData.site_description,
          logo: configData.logo || '',
          favicon: configData.favicon || '',
          contact_email: configData.contact_email,
          contact_phone: configData.contact_phone || '',
          social_links: configData.social_links || {},
          language: configData.language || 'en',
          timezone: configData.timezone || 'UTC',
          currency: configData.currency || 'USD',
          maintenance_mode: configData.maintenance_mode || false,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConfig[0].id)
        .select();
      
      if (error) {
        console.error('❌ Update error:', error);
        return res.status(500).json({ error: 'Failed to update website configuration' });
      }
      
      result = data[0];
      console.log('✅ Website configuration updated:', result);
    } else {
      // Insert new configuration
      const { data, error } = await supabase
        .from('website_config')
        .insert({
          site_title: configData.site_title,
          site_description: configData.site_description,
          logo: configData.logo || '',
          favicon: configData.favicon || '',
          contact_email: configData.contact_email,
          contact_phone: configData.contact_phone || '',
          social_links: configData.social_links || {},
          language: configData.language || 'en',
          timezone: configData.timezone || 'UTC',
          currency: configData.currency || 'USD',
          maintenance_mode: configData.maintenance_mode || false
        })
        .select();
      
      if (error) {
        console.error('❌ Insert error:', error);
        return res.status(500).json({ error: 'Failed to create website configuration' });
      }
      
      result = data[0];
      console.log('✅ Website configuration created:', result);
    }
    
    res.json({ 
      message: 'Website configuration saved successfully',
      config: result 
    });
    
  } catch (error) {
    console.error('❌ Website config save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
