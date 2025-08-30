const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { domainCheckLimiter } = require('../middleware/rateLimit');
const { supabase } = require('../config/database');
const godaddyService = require('../services/godaddyService');

const router = express.Router();

// Check domain availability
router.get('/check', 
  // Only apply rate limiting in production
  process.env.NODE_ENV === 'production' ? domainCheckLimiter : (req, res, next) => next(),
  optionalAuth, 
  async (req, res) => {
  try {
    const { domain } = req.query;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain parameter is required' });
    }

    // Basic domain validation
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(domain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    // Check availability via GoDaddy
    const result = await godaddyService.checkAvailability(domain);

    // Record the check if user is authenticated
    if (req.user) {
      try {
        const { error: insertError } = await supabase
          .from('checked_domains')
          .insert([
            {
              user_id: req.user.id,
              domain,
              status: result.available ? 'Available' : 'Taken',
              price: result.price,
              currency: result.currency,
              period: result.period
            }
          ]);
        
        if (insertError) {
          console.error('Failed to record domain check:', insertError);
        }
      } catch (dbError) {
        console.error('Failed to record domain check:', dbError);
        // Don't fail the request if recording fails
      }
    }

    res.json(result);

  } catch (error) {
    console.error('Domain check error:', error);
    res.status(500).json({ error: 'Failed to check domain availability' });
  }
});

// Get domain suggestions
router.get('/suggest', optionalAuth, async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    if (query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const suggestions = await godaddyService.getSuggestions(query, parseInt(limit));
    res.json(suggestions);

  } catch (error) {
    console.error('Domain suggestions error:', error);
    res.status(500).json({ error: 'Failed to get domain suggestions' });
  }
});

// Get domain estimation/appraisal
router.post('/estimate', domainCheckLimiter, optionalAuth, async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Basic domain validation
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(domain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    const estimation = await godaddyService.getEstimation(domain);
    res.json(estimation);

  } catch (error) {
    console.error('Domain estimation error:', error);
    res.status(500).json({ error: 'Failed to get domain estimation' });
  }
});

// Generate domain combinations
router.post('/combine', domainCheckLimiter, optionalAuth, async (req, res) => {
  try {
    const { prefixes, suffixes, tlds, filters } = req.body;
    
    if (!prefixes || !suffixes || !tlds) {
      return res.status(400).json({ error: 'Prefixes, suffixes, and TLDs are required' });
    }

    if (!Array.isArray(prefixes) || !Array.isArray(suffixes) || !Array.isArray(tlds)) {
      return res.status(400).json({ error: 'Prefixes, suffixes, and TLDs must be arrays' });
    }

    // Generate all combinations
    const generated = [];
    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        for (const tld of tlds) {
          const domain = prefix + suffix + tld;
          
          // Apply filters
          if (filters) {
            if (filters.minLen && domain.length < filters.minLen) continue;
            if (filters.maxLen && domain.length > filters.maxLen) continue;
            if (filters.excludeHyphen && domain.includes('-')) continue;
          }
          
          generated.push(domain);
        }
      }
    }

    // Apply deduplication
    const uniqueDomains = filters?.dedupe ? [...new Set(generated)] : generated;
    
    // Apply limit
    const limitedDomains = filters?.limit ? uniqueDomains.slice(0, filters.limit) : uniqueDomains;

    // Check availability for generated domains if requested
    let checked = [];
    if (filters?.checkAvailability && limitedDomains.length > 0) {
      // Limit the number of domains to check to prevent abuse
      const domainsToCheck = limitedDomains.slice(0, 50);
      checked = await godaddyService.batchCheckAvailability(domainsToCheck, 3);
    }

    res.json({
      generated: limitedDomains,
      checked,
      total: limitedDomains.length
    });

  } catch (error) {
    console.error('Domain combine error:', error);
    res.status(500).json({ error: 'Failed to generate domain combinations' });
  }
});

// Get public suggested domains (for homepage)
router.get('/suggestions', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    
    const { data: domains, error: fetchError } = await supabase
      .from('suggested_domains')
      .select('id, domain, price, estimation_price, extension, status, score, tld, length, description, category')
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (fetchError) {
      throw fetchError;
    }

    res.json(domains || []);

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggested domains' });
  }
});

module.exports = router;
