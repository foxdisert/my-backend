const { sanitizeObject } = require('./secureLogging');

// Input validation and sanitization
const validateAndSanitize = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
    
    // Remove sensitive headers from logging
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitizedHeaders = { ...req.headers };
    sensitiveHeaders.forEach(header => {
      if (sanitizedHeaders[header]) {
        sanitizedHeaders[header] = '[SENSITIVE_DATA]';
      }
    });
    
    // Store sanitized headers for logging
    req.sanitizedHeaders = sanitizedHeaders;
    
    next();
  } catch (error) {
    console.error('Input validation error:', error);
    res.status(400).json({ error: 'Invalid input data' });
  }
};

// Request size limiting
const requestSizeLimit = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  if (contentLength > maxSize) {
    return res.status(413).json({ error: 'Request entity too large' });
  }
  
  next();
};

// SQL Injection protection
const sqlInjectionProtection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|vbscript|onload|onerror)\b)/i,
    /(\b(or|and)\b\s+\d+\s*=\s*\d+)/i,
    /(\b(union|select|insert|update|delete|drop|create|alter)\b\s+.*\b(union|select|insert|update|delete|drop|create|alter)\b)/i,
    /(\b(union|select|insert|update|delete|drop|create|alter)\b.*\b(union|select|insert|update|delete|drop|create|alter)\b)/i
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  const checkObject = (obj) => {
    for (const [key, value] of Object.entries(obj)) {
      if (checkValue(value) || (typeof value === 'object' && value !== null && checkObject(value))) {
        return true;
      }
    }
    return false;
  };
  
  // Check request body
  if (req.body && checkObject(req.body)) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }
  
  // Check query parameters
  if (req.query && checkObject(req.query)) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }
  
  // Check URL parameters
  if (req.params && checkObject(req.params)) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }
  
  next();
};

// XSS Protection
const xssProtection = (req, res, next) => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi
  ];
  
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return xssPatterns.reduce((sanitized, pattern) => {
        return sanitized.replace(pattern, '[XSS_BLOCKED]');
      }, value);
    }
    return value;
  };
  
  const sanitizeObject = (obj) => {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = sanitizeObject(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => sanitizeValue(item));
      } else {
        sanitized[key] = sanitizeValue(value);
      }
    }
    return sanitized;
  };
  
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

// API Key validation (if using API keys)
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Add your API key validation logic here
  // For now, we'll just check if it exists
  next();
};

// Request logging (sanitized)
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    };
    
    // Use sanitized headers
    if (req.sanitizedHeaders) {
      logData.headers = req.sanitizedHeaders;
    }
    
    console.log(`📝 ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
};

// Error response sanitization
const sanitizeErrorResponse = (err, req, res, next) => {
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production') {
    const sanitizedError = {
      error: 'Internal server error',
      message: 'Something went wrong',
      timestamp: new Date().toISOString()
    };
    
    res.status(err.status || 500).json(sanitizedError);
  } else {
    // In development, show more details but still sanitize sensitive data
    const sanitizedError = {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    };
    
    res.status(err.status || 500).json(sanitizedError);
  }
};

module.exports = {
  validateAndSanitize,
  requestSizeLimit,
  sqlInjectionProtection,
  xssProtection,
  validateApiKey,
  requestLogger,
  sanitizeErrorResponse
};
