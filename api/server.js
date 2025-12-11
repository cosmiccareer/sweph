const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const astrologyRoutes = require('./routes/astrology');
const { requireApiKey, createRateLimiter, requestLogger } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use(requestLogger);

// Rate limiting (100 requests per minute per IP)
const rateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  message: 'Too many requests. Please wait before trying again.'
});
app.use('/api', rateLimiter);

// API routes with optional authentication
// To enable API key protection, set API_KEY environment variable
// e.g., API_KEY=your-secret-key pm2 restart astrology-api
app.use('/api/v1', requireApiKey, astrologyRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Astrology Chart API',
    version: '2.0.0',
    authentication: process.env.API_KEY ? 'API key required (X-API-Key header)' : 'No authentication (development mode)',
    endpoints: {
      natal: {
        'POST /api/v1/chart': 'Calculate natal chart',
        'POST /api/v1/chart/full': 'Chart with VSP, Mars Phase',
        'POST /api/v1/chart/comprehensive': 'All calculations in one call'
      },
      venusStarPoint: {
        'POST /api/v1/vsp': 'Get Venus Star Point for birth date',
        'POST /api/v1/venus-star': 'Get full 5-point Venus Star',
        'GET /api/v1/vsp/next': 'Next upcoming VSP'
      },
      marsPhase: {
        'POST /api/v1/mars-phase': 'Get Mars Phase for birth date',
        'POST /api/v1/mars-cycle': 'Full Mars cycle context',
        'GET /api/v1/mars-phase/next': 'Next upcoming Mars Phase',
        'GET /api/v1/mars-phase/phases': 'List all 13 phase names'
      },
      advanced: {
        'POST /api/v1/lunar-phase': 'Calculate lunar phase',
        'POST /api/v1/progressions': 'Secondary progressions',
        'POST /api/v1/prenatal-eclipses': 'Prenatal solar/lunar eclipses',
        'POST /api/v1/planetary-phases': 'Planetary phase relationships',
        'POST /api/v1/transits': 'Current transits to natal chart'
      },
      reference: {
        'GET /api/v1/planets': 'Current planetary positions',
        'GET /api/v1/timezones': 'List common timezones',
        'GET /api/v1/house-systems': 'Supported house systems'
      },
      system: {
        'GET /health': 'Health check'
      }
    },
    example: {
      endpoint: 'POST /api/v1/chart/comprehensive',
      headers: { 'X-API-Key': 'your-api-key' },
      body: {
        year: 1988,
        month: 1,
        day: 14,
        hour: 10,
        minute: 22,
        latitude: 40.7128,
        longitude: -74.006,
        timezone: 'America/New_York'
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    hint: 'Visit / for complete API documentation',
    commonEndpoints: [
      'POST /api/v1/chart/comprehensive',
      'POST /api/v1/chart',
      'POST /api/v1/vsp',
      'POST /api/v1/mars-phase',
      'GET /health'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Astrology API running on http://127.0.0.1:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
