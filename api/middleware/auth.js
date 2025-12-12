/**
 * API Authentication Middleware
 *
 * Supports two authentication modes:
 * 1. Master API Key (API_KEY env var) - full access, used by ChatGPT GPT
 * 2. User-specific codes - individual codes for paying customers with usage tracking
 *
 * Usage:
 * - Master key: Set API_KEY environment variable
 * - User codes: Add to data/user-codes.json
 * - Clients include the key in requests via:
 *   - Header: X-API-Key: your-api-key
 *   - Header: Authorization: Bearer your-api-key
 *   - Query parameter: ?api_key=your-api-key
 */

const fs = require('fs');
const path = require('path');

// In-memory usage tracking (resets on server restart)
// For production, use Redis or a database
const usageTracking = new Map();

/**
 * Load user codes from JSON file
 */
function loadUserCodes() {
  try {
    const filePath = path.join(__dirname, '../data/user-codes.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Could not load user-codes.json:', error.message);
    return { users: {} };
  }
}

/**
 * Save user codes to JSON file
 */
function saveUserCodes(data) {
  try {
    const filePath = path.join(__dirname, '../data/user-codes.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Could not save user-codes.json:', error.message);
    return false;
  }
}

/**
 * Get today's date key for usage tracking
 */
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get user's usage count for today
 */
function getUserUsageToday(userCode) {
  const todayKey = getTodayKey();
  const userUsage = usageTracking.get(userCode);

  if (!userUsage || userUsage.date !== todayKey) {
    return 0;
  }

  return userUsage.count;
}

/**
 * Increment user's usage count
 */
function incrementUserUsage(userCode) {
  const todayKey = getTodayKey();
  const userUsage = usageTracking.get(userCode);

  if (!userUsage || userUsage.date !== todayKey) {
    usageTracking.set(userCode, { date: todayKey, count: 1 });
  } else {
    userUsage.count++;
  }
}

/**
 * Extract API key from request
 */
function extractApiKey(req) {
  // Check X-API-Key header
  const headerKey = req.headers['x-api-key'];
  if (headerKey) return headerKey;

  // Check Authorization Bearer header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query parameter
  const queryKey = req.query.api_key;
  if (queryKey) return queryKey;

  return null;
}

/**
 * Validate API key from request
 * Returns: { valid: boolean, type: 'master'|'user'|null, user?: object, error?: string }
 */
function validateApiKey(req) {
  const configuredKey = process.env.API_KEY;
  const providedKey = extractApiKey(req);

  // If no API key is configured and no key provided, allow all (dev mode)
  if (!configuredKey && !providedKey) {
    return { valid: true, type: null };
  }

  // No key provided but key is required
  if (!providedKey) {
    return { valid: false, type: null, error: 'API key required' };
  }

  // Check master API key
  if (configuredKey && providedKey === configuredKey) {
    return { valid: true, type: 'master' };
  }

  // Check user-specific codes
  const userCodesData = loadUserCodes();
  const users = userCodesData.users || {};

  if (users[providedKey]) {
    const user = users[providedKey];

    // Check if user is enabled
    if (!user.enabled) {
      return { valid: false, type: 'user', error: 'Access code disabled' };
    }

    // Check daily limit
    const dailyLimit = user.dailyLimit || 100;
    const todayUsage = getUserUsageToday(providedKey);

    if (dailyLimit !== -1 && todayUsage >= dailyLimit) {
      return {
        valid: false,
        type: 'user',
        error: `Daily limit reached (${dailyLimit} requests). Resets at midnight UTC.`,
        user
      };
    }

    return { valid: true, type: 'user', user, code: providedKey };
  }

  return { valid: false, type: null, error: 'Invalid API key' };
}

/**
 * API Key Authentication Middleware
 * Rejects requests without a valid API key
 */
function requireApiKey(req, res, next) {
  const validation = validateApiKey(req);

  if (validation.valid) {
    // Track usage for user codes
    if (validation.type === 'user' && validation.code) {
      incrementUserUsage(validation.code);
      req.userCode = validation.code;
      req.userData = validation.user;
    }
    req.authType = validation.type;
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: validation.error || 'Valid API key required.',
    hint: 'Include via X-API-Key header, Authorization: Bearer header, or api_key query parameter.'
  });
}

/**
 * Optional API Key Middleware
 * Allows requests without API key but marks them as unauthenticated
 */
function optionalApiKey(req, res, next) {
  const validation = validateApiKey(req);
  req.isAuthenticated = validation.valid;
  req.authType = validation.type;
  if (validation.user) {
    req.userData = validation.user;
  }
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
 */
function configureCors(allowedOrigins = []) {
  return function cors(req, res, next) {
    const origin = req.headers.origin;

    if (allowedOrigins.length === 0) {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    return next();
  };
}

/**
 * Request Logging Middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const userInfo = req.userCode ? ` [${req.userCode}]` : '';
    console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip}${userInfo}`);
  });

  return next();
}

/**
 * Admin: Add new user code
 */
function addUserCode(code, userData) {
  const data = loadUserCodes();
  data.users[code] = {
    ...userData,
    createdAt: new Date().toISOString().split('T')[0],
    enabled: true
  };
  return saveUserCodes(data);
}

/**
 * Admin: Disable user code
 */
function disableUserCode(code) {
  const data = loadUserCodes();
  if (data.users[code]) {
    data.users[code].enabled = false;
    return saveUserCodes(data);
  }
  return false;
}

/**
 * Admin: Get all users
 */
function getAllUsers() {
  const data = loadUserCodes();
  return Object.entries(data.users).map(([code, user]) => ({
    code,
    ...user,
    todayUsage: getUserUsageToday(code)
  }));
}

/**
 * Generate a random user code
 */
function generateUserCode(prefix = 'COSMO') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix + '-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = {
  requireApiKey,
  optionalApiKey,
  validateApiKey,
  createRateLimiter,
  configureCors,
  requestLogger,
  addUserCode,
  disableUserCode,
  getAllUsers,
  generateUserCode,
  getUserUsageToday
};
