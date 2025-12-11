/**
 * API Authentication Middleware
 *
 * Provides simple API key authentication for protecting endpoints.
 * The API key should be set via environment variable: API_KEY
 *
 * Usage:
 * - Set API_KEY environment variable on the server
 * - Clients include the key in requests via:
 *   - Header: X-API-Key: your-api-key
 *   - Header: Authorization: Bearer your-api-key
 *   - Query parameter: ?api_key=your-api-key
 */

/**
 * Validate API key from request
 * @param {Request} req - Express request object
 * @returns {boolean} - Whether the API key is valid
 */
function validateApiKey(req) {
  const configuredKey = process.env.API_KEY;

  // If no API key is configured, allow all requests (development mode)
  if (!configuredKey) {
    return true;
  }

  // Check X-API-Key header
  const headerKey = req.headers['x-api-key'];
  if (headerKey && headerKey === configuredKey) {
    return true;
  }

  // Check Authorization Bearer header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerKey = authHeader.substring(7);
    if (bearerKey === configuredKey) {
      return true;
    }
  }

  // Check query parameter
  const queryKey = req.query.api_key;
  if (queryKey && queryKey === configuredKey) {
    return true;
  }

  return false;
}

/**
 * API Key Authentication Middleware
 * Rejects requests without a valid API key
 */
function requireApiKey(req, res, next) {
  if (validateApiKey(req)) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Valid API key required. Include via X-API-Key header, Authorization: Bearer header, or api_key query parameter.'
  });
}

/**
 * Optional API Key Middleware
 * Allows requests without API key but marks them as unauthenticated
 */
function optionalApiKey(req, res, next) {
  req.isAuthenticated = validateApiKey(req);
  return next();
}

/**
 * Rate Limiting Helper
 * Simple in-memory rate limiter
 */
const requestCounts = new Map();

function createRateLimiter(options = {}) {
  const {
    windowMs = 60000,       // 1 minute window
    maxRequests = 100,      // 100 requests per window
    message = 'Too many requests, please try again later.'
  } = options;

  return function rateLimiter(req, res, next) {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, { count: 1, windowStart: now });
      return next();
    }

    const record = requestCounts.get(key);

    // Reset window if expired
    if (now - record.windowStart > windowMs) {
      record.count = 1;
      record.windowStart = now;
      return next();
    }

    // Check if over limit
    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message,
        retryAfter: Math.ceil((record.windowStart + windowMs - now) / 1000)
      });
    }

    record.count++;
    return next();
  };
}

/**
 * CORS Configuration Middleware
 * Configure which origins can access the API
 */
function configureCors(allowedOrigins = []) {
  return function cors(req, res, next) {
    const origin = req.headers.origin;

    // Allow all origins if none specified (development mode)
    if (allowedOrigins.length === 0) {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    return next();
  };
}

/**
 * Request Logging Middleware
 * Logs API requests for monitoring
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip}`);
  });

  return next();
}

module.exports = {
  requireApiKey,
  optionalApiKey,
  validateApiKey,
  createRateLimiter,
  configureCors,
  requestLogger
};
