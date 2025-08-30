const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { supabase } = require('../config/database');

const router = express.Router();

// Get user's domain check history
router.get('/checks', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const { data: checks, error: fetchError } = await supabase
      .from('checked_domains')
      .select('id, domain, status, price, currency, period, checked_at')
      .eq('user_id', req.user.id)
      .order('checked_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (fetchError) {
      throw fetchError;
    }

    // Normalize status values to match frontend expectations
    const normalizedChecks = (checks || []).map(check => ({
      ...check,
      status: check.status.toLowerCase(),
      checked_at: check.checked_at
    }));

    res.json(normalizedChecks);

  } catch (error) {
    console.error('Get checks error:', error);
    res.status(500).json({ error: 'Failed to get check history' });
  }
});

// Record a domain check
router.post('/checks', authenticateToken, async (req, res) => {
  try {
    const { domain, status, price, currency, period } = req.body;
    
    if (!domain || !status) {
      return res.status(400).json({ error: 'Domain and status are required' });
    }

    const { data: insertedCheck, error: insertError } = await supabase
      .from('checked_domains')
      .insert([
        {
          user_id: req.user.id,
          domain,
          status,
          price: price || null,
          currency: currency || 'USD',
          period: period || 1
        }
      ])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    res.status(201).json({
      id: insertedCheck.id,
      domain: insertedCheck.domain,
      status: insertedCheck.status.toLowerCase(),
      price: insertedCheck.price,
      currency: insertedCheck.currency,
      period: insertedCheck.period,
      checked_at: insertedCheck.checked_at
    });

  } catch (error) {
    console.error('Record check error:', error);
    res.status(500).json({ error: 'Failed to record domain check' });
  }
});

// Get user's favorite domains
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const { data: favorites, error: fetchError } = await supabase
      .from('favorites')
      .select('id, domain, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    res.json(favorites || []);

  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Add domain to favorites
router.post('/favorites', authenticateToken, async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const { data: newFavorite, error: insertError } = await supabase
      .from('favorites')
      .insert([
        {
          user_id: req.user.id,
          domain
        }
      ])
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Domain is already in favorites' });
      }
      throw insertError;
    }

    res.status(201).json({
      id: newFavorite.id,
      domain: newFavorite.domain,
      created_at: newFavorite.created_at
    });

  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add to favorites' });
  }
});

// Remove domain from favorites
router.delete('/favorites/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: result, error: deleteError } = await supabase
      .from('favorites')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select();

    if (deleteError) {
      throw deleteError;
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ message: 'Favorite removed successfully' });

  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .eq('id', req.user.id)
      .limit(1);

    if (fetchError) {
      throw fetchError;
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if email is already taken by another user
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .neq('id', req.user.id)
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email is already taken' });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ name, email })
      .eq('id', req.user.id);

    if (updateError) {
      throw updateError;
    }

    res.json({ message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
