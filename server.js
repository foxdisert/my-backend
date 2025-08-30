const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { testConnection, initDatabase } = require('./config/database');
const { globalLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFound } = require('./middleware/error');

// Import routes
const authRoutes = require('./routes/auth');
const domainRoutes = require('./routes/domains');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, or file:// origins)
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'production') {
      // Production: Allow specific Vercel URLs and localhost
      const allowedOrigins = [
        'https://dnv1b-9mhl6pjve-foxdiserts-projects.vercel.app',
        'https://dnv1b-neucyckqe-foxdiserts-projects.vercel.app',
        'https://dnv1b-fsnhwkown-foxdiserts-projects.vercel.app',
        'https://dnv1f-pf75ngvz1-foxdiserts-projects.vercel.app',
        'https://dnv1f-631kqrwzx-foxdiserts-projects.vercel.app',
        'https://dnv1f-1jinktkwr-foxdiserts-projects.vercel.app',
        'https://dnv1f-b0jc74usj-foxdiserts-projects.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
      ];
      
      // Also allow any Vercel frontend URL pattern
      if (origin.includes('foxdiserts-projects.vercel.app') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    } else {
      // Development: Allow localhost (any port) and file:// origins for testing
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('file://')) {
        return callback(null, true);
      }
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

// Rate limiting - more lenient in development
if (process.env.NODE_ENV === 'production') {
  app.use(globalLimiter);
  console.log('🔒 Production mode: Rate limiting enabled');
} else {
  console.log('🚀 Development mode: Rate limiting disabled for local testing');
}

// Body parsing middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// Static files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rate limit reset endpoint (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/reset-rate-limit', (req, res) => {
    // This will help reset rate limiting during development
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

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize database tables
    await initDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📝 API docs: http://localhost:${PORT}/api`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
