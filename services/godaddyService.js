const axios = require('axios');

class GoDaddyService {
  constructor() {
    this.baseURL = process.env.GODADDY_BASE_URL;
    this.apiKey = process.env.GODADDY_API_KEY;
    this.apiSecret = process.env.GODADDY_API_SECRET;
    
    // Check if we're in development mode and credentials are missing
    if (!this.baseURL || !this.apiKey || !this.apiSecret) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  GoDaddy API credentials not configured - using mock responses for development');
        this.mockMode = true;
        // Initialize mock data storage for consistent results
        this.mockData = new Map();
        return;
      } else {
        throw new Error('GoDaddy API credentials not configured');
      }
    }
    
    this.mockMode = false;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `sso-key ${this.apiKey}:${this.apiSecret}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  // Helper method to get consistent mock data for a domain
  getMockData(domain) {
    if (!this.mockData.has(domain)) {
      // Generate consistent mock data based on domain hash
      const hash = domain.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      const available = (hash % 3) === 0; // 33% chance of being available
      const price = 10 + (hash % 40); // Price between 10-50
      
      this.mockData.set(domain, {
        available,
        price,
        currency: 'USD',
        period: 1
      });
    }
    
    return this.mockData.get(domain);
  }

  // Check domain availability
  async checkAvailability(domain) {
    if (this.mockMode) {
      // Mock response for development with consistent results
      const mockData = this.getMockData(domain);
      return {
        domain,
        available: mockData.available,
        price: mockData.price,
        currency: mockData.currency,
        period: mockData.period,
      };
    }

    try {
      const { data } = await this.client.get(`/v1/domains/available?domain=${encodeURIComponent(domain)}`);
      return {
        domain,
        available: data.available,
        price: data.price ? data.price / 100 : null, // Convert cents to dollars
        currency: data.currency || 'USD',
        period: data.period || 1,
      };
    } catch (error) {
      console.error('GoDaddy API error (availability):', error.response?.data || error.message);
      throw new Error('Failed to check domain availability');
    }
  }

  // Get domain suggestions
  async getSuggestions(query, limit = 10) {
    if (this.mockMode) {
      // Mock response for development with consistent results
      const mockSuggestions = [];
      for (let i = 0; i < limit; i++) {
        const domain = `${query}${i + 1}.com`;
        const mockData = this.getMockData(domain);
        mockSuggestions.push({
          domain,
          available: mockData.available,
          price: mockData.price,
          currency: mockData.currency
        });
      }
      return mockSuggestions;
    }

    try {
      const { data } = await this.client.get(`/v1/domains/suggest?query=${encodeURIComponent(query)}&limit=${limit}`);
      return (data || []).map(d => ({
        domain: d.domain,
        available: d.isAvailable ?? d.available,
        price: d.price ? d.price / 100 : null, // Convert cents to dollars
        currency: d.currency || 'USD'
      }));
    } catch (error) {
      console.error('GoDaddy API error (suggestions):', error.response?.data || error.message);
      throw new Error('Failed to get domain suggestions');
    }
  }

  // Get domain appraisal/estimation
  async getEstimation(domain) {
    if (this.mockMode) {
      // Mock response for development
      return {
        value: Math.floor(Math.random() * 10000) + 100,
        confidence: Math.floor(Math.random() * 40) + 60,
        comps: []
      };
    }

    try {
      const { data } = await this.client.post(`/appraisal/${encodeURIComponent(domain)}`, {});
      return data; // Include value, confidence, comps if present
    } catch (error) {
      console.error('GoDaddy API error (estimation):', error.response?.data || error.message);
      throw new Error('Failed to get domain estimation');
    }
  }

  // Batch check multiple domains with throttling
  async batchCheckAvailability(domains, concurrency = 3) {
    const results = [];
    const chunks = this.chunkArray(domains, concurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(domain => this.checkAvailability(domain));
      const chunkResults = await Promise.allSettled(promises);
      
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            domain: chunk[index],
            available: false,
            error: result.reason.message
          });
        }
      });
      
      // Add delay between chunks to respect rate limits
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(1000);
      }
    }
    
    return results;
  }

  // Check domain availability (alias for checkAvailability)
  async checkDomainAvailability(domain) {
    try {
      const result = await this.checkAvailability(domain);
      
      // Add status field for CSV service compatibility
      return {
        ...result,
        status: result.available ? 'Available' : 'Taken',
        available: result.available
      };
    } catch (error) {
      console.error(`Error checking domain availability for ${domain}:`, error);
      return null;
    }
  }

  // Helper: Split array into chunks
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Helper: Delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new GoDaddyService();
