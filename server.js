const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { testConnection, initDatabase } = require('./config/database');
const { globalLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFound } = require('./middleware/error');
const { secureLogging, secureConsole } = require('./middleware/secureLogging');
const { 
  validateAndSanitize, 
  requestSizeLimit, 
  sqlInjectionProtection, 
  xssProtection, 
  requestLogger, 
  sanitizeErrorResponse 
} = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const domainRoutes = require('./routes/domains');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const seoRoutes = require('./routes/seo');

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware (Helmet with CSP updated)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://frontdn.netlify.app"], // ✅ Allow frontend
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// ✅ CORS configuration (frontend + localhost)
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // mobile apps, curl, etc.

    const allowedOrigins = [
      'https://mydntk.com', // your frontend
      'http://localhost:3000', // local dev
      'https://wwwmydntk.com'
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Handle preflight requests
app.options('*', cors());

// Rate limiting
if (process.env.NODE_ENV === 'production') {
  app.use(globalLimiter);
  secureConsole.log('🔒 Production mode: Rate limiting enabled');
} else {
  secureConsole.log('🚀 Development mode: Rate limiting disabled for local testing');
}

// Security middleware
app.use(secureLogging);
app.use(requestLogger);
app.use(validateAndSanitize);
app.use(requestSizeLimit);
app.use(sqlInjectionProtection);
app.use(xssProtection);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rate limit reset (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/reset-rate-limit', (req, res) => {
    res.json({ 
      message: 'Rate limit reset endpoint available',
      note: 'Rate limiting is currently disabled in development mode'
    });
  });
}

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seo', seoRoutes);

// Public SEO routes
app.use('/robots.txt', seoRoutes);
app.use('/sitemap.xml', seoRoutes);

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(sanitizeErrorResponse);
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    await testConnection();
    await initDatabase();

    app.listen(PORT, () => {
      secureConsole.log(`🚀 Server running on port ${PORT}`);
      secureConsole.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      secureConsole.log(`🔗 Health check: http://localhost:${PORT}/health`);
      secureConsole.log(`📝 API docs: http://localhost:${PORT}/api`);
    });
    
  } catch (error) {
    secureConsole.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  secureConsole.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  secureConsole.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  secureConsole.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  secureConsole.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
