const sensitiveFields = [
  'password',
  'token',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'session',
  'private',
  'confidential',
  'sensitive',
  'personal',
  'credit_card',
  'ssn',
  'phone',
  'address',
  'email'
];

const sensitivePatterns = [
  /password/i,
  /token/i,
  /api[_-]?key/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /private/i,
  /confidential/i,
  /sensitive/i,
  /personal/i,
  /credit[_-]?card/i,
  /ssn/i,
  /phone/i,
  /address/i,
  /email/i
];

// Sanitize object recursively
const sanitizeObject = (obj, depth = 0) => {
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]'; // Prevent infinite recursion
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    // Check if string contains sensitive data patterns
    if (sensitivePatterns.some(pattern => pattern.test(obj))) {
      return '[SENSITIVE_DATA]';
    }
    return obj;
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if key contains sensitive field names
      if (sensitiveFields.some(field => lowerKey.includes(field)) ||
          sensitivePatterns.some(pattern => pattern.test(key))) {
        sanitized[key] = '[SENSITIVE_DATA]';
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }
    return sanitized;
  }
  
  return obj;
};

// Secure logging middleware
const secureLogging = (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Override res.send to sanitize response data
  res.send = function(data) {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        const sanitized = sanitizeObject(parsed);
        return originalSend.call(this, JSON.stringify(sanitized));
      } catch {
        // If it's not JSON, return as is
        return originalSend.call(this, data);
      }
    }
    return originalSend.call(this, data);
  };
  
  // Override res.json to sanitize response data
  res.json = function(data) {
    const sanitized = sanitizeObject(data);
    return originalJson.call(this, sanitized);
  };
  
  next();
};

// Secure console.log wrapper
const secureConsole = {
  log: (...args) => {
    const sanitizedArgs = args.map(arg => sanitizeObject(arg));
    console.log(...sanitizedArgs);
  },
  
  error: (...args) => {
    const sanitizedArgs = args.map(arg => sanitizeObject(arg));
    console.error(...sanitizedArgs);
  },
  
  warn: (...args) => {
    const sanitizedArgs = args.map(arg => sanitizeObject(arg));
    console.warn(...sanitizedArgs);
  },
  
  info: (...args) => {
    const sanitizedArgs = args.map(arg => sanitizeObject(arg));
    console.info(...sanitizedArgs);
  }
};

module.exports = {
  secureLogging,
  secureConsole,
  sanitizeObject
};
