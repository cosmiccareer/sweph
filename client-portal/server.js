/**
 * CCBBB Client Portal - Main Server
 * Cosmic Clarity & Breakthrough Business Blueprint
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import driveRoutes from './routes/drive.js';
import templateRoutes from './routes/templates.js';
import progressRoutes from './routes/progress.js';
import chatRoutes from './routes/chat.js';
import astrologyRoutes from './routes/astrology.js';

// Import middleware
import { authenticateToken } from './middleware/auth.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORTAL_PORT || 3001;

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.anthropic.com", "https://www.googleapis.com"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// =============================================================================
// ROUTES
// =============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ccbbb-client-portal',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Public routes
app.use('/api/v1/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/v1/drive', authenticateToken, driveRoutes);
app.use('/api/v1/templates', authenticateToken, templateRoutes);
app.use('/api/v1/progress', authenticateToken, progressRoutes);
app.use('/api/v1/chat', authenticateToken, chatRoutes);
app.use('/api/v1/astrology', authenticateToken, astrologyRoutes);

// Serve static files for production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));

  // Handle SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
  });
}

// API documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'CCBBB Client Portal API',
    version: '1.0.0',
    description: 'Cosmic Clarity & Breakthrough Business Blueprint - Client Portal',
    endpoints: {
      auth: {
        'POST /api/v1/auth/login': 'Authenticate user (WordPress SSO or local)',
        'POST /api/v1/auth/register': 'Register new user',
        'POST /api/v1/auth/refresh': 'Refresh access token',
        'POST /api/v1/auth/logout': 'Invalidate session'
      },
      drive: {
        'GET /api/v1/drive/folders': 'List available template folders',
        'GET /api/v1/drive/files/:folderId': 'List files in a folder',
        'GET /api/v1/drive/file/:fileId': 'Get file content or metadata',
        'POST /api/v1/drive/copy/:fileId': 'Copy template to user workspace'
      },
      templates: {
        'GET /api/v1/templates': 'List available templates by category',
        'GET /api/v1/templates/:id': 'Get specific template details',
        'POST /api/v1/templates/:id/generate': 'Generate personalized document',
        'GET /api/v1/templates/categories': 'Get template categories'
      },
      progress: {
        'GET /api/v1/progress': 'Get user course progress',
        'POST /api/v1/progress/:moduleId': 'Update module progress',
        'GET /api/v1/progress/documents': 'Get user generated documents',
        'GET /api/v1/progress/summary': 'Get progress summary'
      },
      chat: {
        'POST /api/v1/chat/message': 'Send message to AI assistant',
        'GET /api/v1/chat/history': 'Get chat history',
        'POST /api/v1/chat/context': 'Set chat context (module, template)',
        'DELETE /api/v1/chat/history': 'Clear chat history'
      },
      astrology: {
        'GET /api/v1/astrology/profile': 'Get user astrology profile',
        'POST /api/v1/astrology/calculate': 'Calculate natal chart',
        'GET /api/v1/astrology/ikigai': 'Get Ikigai analysis',
        'GET /api/v1/astrology/business-insights': 'Get business-oriented insights'
      }
    },
    authentication: 'Bearer token in Authorization header'
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`CCBBB Client Portal API`);
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API Docs: http://localhost:${PORT}/api`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
});

export default app;
