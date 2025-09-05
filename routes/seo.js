const express = require('express');
const { supabase } = require('../config/database');

const router = express.Router();

// Get SEO meta tags for public pages (no authentication required)
router.get('/meta-tags', async (req, res) => {
  try {
    console.log('📋 Fetching SEO meta tags for public pages...');
    
    const { data, error } = await supabase
      .from('seo_settings')
      .select('*')
      .order('id', { ascending: true })
      .limit(1);
    
    if (error) {
      console.error('❌ Database error:', error);
      // Return default meta tags if database fails
      return res.json({
        title: 'Domain Toolkit - Check, Suggest, Estimate & Combine Domains',
        description: 'Professional domain toolkit for checking availability, getting suggestions, estimating values, and generating creative domain combinations. Powered by GoDaddy API.',
        keywords: 'domain checker, domain availability, domain suggestions, domain appraisal, domain generator, domain toolkit',
        author: 'Domain Toolkit',
        ogTitle: 'Domain Toolkit - Professional Domain Management',
        ogDescription: 'Check domain availability, get suggestions, estimate values, and generate creative domain combinations.',
        ogType: 'website',
        ogUrl: process.env.SITE_URL || 'https://mydntk.com',
        ogImage: process.env.SITE_URL ? `${process.env.SITE_URL}/og-image.jpg` : 'https://mydntk.com/og-image.jpg',
        twitterCard: 'summary_large_image',
        twitterTitle: 'Domain Toolkit - Professional Domain Management',
        twitterDescription: 'Check domain availability, get suggestions, estimate values, and generate creative domain combinations.',
        twitterImage: process.env.SITE_URL ? `${process.env.SITE_URL}/twitter-image.jpg` : 'https://mydntk.com/twitter-image.jpg',
        robots: 'index, follow',
        themeColor: '#3B82F6',
        canonicalUrl: process.env.SITE_URL || 'https://mydntk.com'
      });
    }
    
    if (data && data.length > 0) {
      const settings = data[0];
      console.log('✅ SEO meta tags fetched:', settings);
      
      // Map database fields to meta tag format
      const metaTags = {
        title: settings.meta_title || 'Domain Toolkit - Check, Suggest, Estimate & Combine Domains',
        description: settings.meta_description || 'Professional domain toolkit for checking availability, getting suggestions, estimating values, and generating creative domain combinations. Powered by GoDaddy API.',
        keywords: settings.meta_keywords || 'domain checker, domain availability, domain suggestions, domain appraisal, domain generator, domain toolkit',
        author: 'Domain Toolkit',
        ogTitle: settings.meta_title || 'Domain Toolkit - Professional Domain Management',
        ogDescription: settings.meta_description || 'Check domain availability, get suggestions, estimate values, and generate creative domain combinations.',
        ogType: 'website',
        ogUrl: process.env.SITE_URL || 'https://mydntk.com',
        ogImage: process.env.SITE_URL ? `${process.env.SITE_URL}/og-image.jpg` : 'https://mydntk.com/og-image.jpg',
        twitterCard: 'summary_large_image',
        twitterTitle: settings.meta_title || 'Domain Toolkit - Professional Domain Management',
        twitterDescription: settings.meta_description || 'Check domain availability, get suggestions, estimate values, and generate creative domain combinations.',
        twitterImage: process.env.SITE_URL ? `${process.env.SITE_URL}/twitter-image.jpg` : 'https://mydntk.com/twitter-image.jpg',
        robots: settings.robots_txt ? 'index, follow' : 'noindex, nofollow',
        themeColor: '#3B82F6',
        canonicalUrl: process.env.SITE_URL || 'https://mydntk.com',
        googleAnalytics: settings.google_analytics || '',
        googleSearchConsole: settings.google_search_console || '',
        sitemapEnabled: settings.sitemap_enabled || true,
        canonicalUrls: settings.canonical_urls || true,
        structuredData: settings.structured_data || true,
        socialMediaTags: settings.social_media_tags || true
      };
      
      res.json(metaTags);
    } else {
      // Return default meta tags if no settings exist
      res.json({
        title: 'Domain Toolkit - Check, Suggest, Estimate & Combine Domains',
        description: 'Professional domain toolkit for checking availability, getting suggestions, estimating values, and generating creative domain combinations. Powered by GoDaddy API.',
        keywords: 'domain checker, domain availability, domain suggestions, domain appraisal, domain generator, domain toolkit',
        author: 'Domain Toolkit',
        ogTitle: 'Domain Toolkit - Professional Domain Management',
        ogDescription: 'Check domain availability, get suggestions, estimate values, and generate creative domain combinations.',
        ogType: 'website',
        ogUrl: process.env.SITE_URL || 'https://mydntk.com',
        ogImage: process.env.SITE_URL ? `${process.env.SITE_URL}/og-image.jpg` : 'https://mydntk.com/og-image.jpg',
        twitterCard: 'summary_large_image',
        twitterTitle: 'Domain Toolkit - Professional Domain Management',
        twitterDescription: 'Check domain availability, get suggestions, estimate values, and generate creative domain combinations.',
        twitterImage: process.env.SITE_URL ? `${process.env.SITE_URL}/twitter-image.jpg` : 'https://mydntk.com/twitter-image.jpg',
        robots: 'index, follow',
        themeColor: '#3B82F6',
        canonicalUrl: process.env.SITE_URL || 'https://mydntk.com'
      });
    }
    
  } catch (error) {
    console.error('❌ SEO meta tags fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get robots.txt content
router.get('/robots.txt', async (req, res) => {
  try {
    console.log('🤖 Fetching robots.txt content...');
    
    const { data, error } = await supabase
      .from('seo_settings')
      .select('robots_txt, sitemap_enabled')
      .order('id', { ascending: true })
      .limit(1);
    
    if (error || !data || data.length === 0) {
      // Return default robots.txt
      res.set('Content-Type', 'text/plain');
      res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Sitemap: ${process.env.SITE_URL || 'https://mydntk.com'}/sitemap.xml`);
      return;
    }
    
    const settings = data[0];
    let robotsContent = settings.robots_txt || `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api`;

    // Add sitemap if enabled
    if (settings.sitemap_enabled) {
      robotsContent += `\nSitemap: ${process.env.SITE_URL || 'https://mydntk.com'}/sitemap.xml`;
    }
    
    res.set('Content-Type', 'text/plain');
    res.send(robotsContent);
    
  } catch (error) {
    console.error('❌ Robots.txt fetch error:', error);
    res.status(500).send('User-agent: *\nAllow: /');
  }
});

// Get sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  try {
    console.log('🗺️ Fetching sitemap.xml...');
    
    const { data, error } = await supabase
      .from('seo_settings')
      .select('sitemap_enabled')
      .order('id', { ascending: true })
      .limit(1);
    
    if (error || !data || data.length === 0 || !data[0].sitemap_enabled) {
      res.status(404).send('Sitemap not available');
      return;
    }
    
    const baseUrl = process.env.SITE_URL || 'https://mydntk.com';
    const currentDate = new Date().toISOString();
    
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/domains</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/suggestions</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`;
    
    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
    
  } catch (error) {
    console.error('❌ Sitemap fetch error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
