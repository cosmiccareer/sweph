const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const astrologyRoutes = require('./routes/astrology');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// API routes
app.use('/api/v1', astrologyRoutes);

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
    version: '1.0.0',
    endpoints: {
      'POST /api/v1/chart': 'Calculate natal chart (requires timezone)',
      'GET /api/v1/planets': 'Get current planetary positions',
      'GET /api/v1/timezones': 'List common timezones',
      'GET /api/v1/house-systems': 'List supported house systems',
      'GET /health': 'Health check'
    },
    example: {
      endpoint: 'POST /api/v1/chart',
      body: {
        year: 1988,
        month: 1,
        day: 14,
        hour: 10,
        minute: 22,
        latitude: 40.7128,
        longitude: -74.006,
        timezone: 'America/New_York',
        houseSystem: 'P'
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    availableEndpoints: [
      'POST /api/v1/chart',
      'GET /api/v1/planets',
      'GET /api/v1/timezones',
      'GET /api/v1/house-systems',
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
