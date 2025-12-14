/**
 * Authentication Routes
 * Handles user registration, login, and session management
 * Implements single active session + device limiting
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  generateTokens,
  verifyRefreshToken,
  validateWordPressSession,
  authenticateToken
} from '../middleware/auth.js';
import { getDb } from '../services/database.js';
import {
  registerDevice,
  createSession,
  validateSession,
  getUserDevices,
  removeDevice,
  generateDeviceFingerprint,
  parseUserAgent,
  MAX_DEVICES
} from '../services/sessionManager.js';

const router = express.Router();

// =============================================================================
// LOCAL AUTHENTICATION
// =============================================================================

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, birthData, deviceFingerprint, deviceName } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }

    // Check if user exists
    const db = getDb();
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userId = uuidv4();
    const result = await db.query(
      `INSERT INTO users (id, email, password_hash, name, birth_data, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, email, name, role, created_at`,
      [userId, email.toLowerCase(), hashedPassword, name, JSON.stringify(birthData || {})]
    );

    const user = result.rows[0];

    // Register device
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const fingerprint = deviceFingerprint || generateDeviceFingerprint(userAgent, ipAddress);

    const deviceResult = await registerDevice(user.id, {
      fingerprint,
      userAgent,
      ipAddress,
      deviceName
    });

    // Generate tokens
    const tokens = generateTokens(user);

    // Create session with device tracking
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const sessionId = await createSession(user.id, deviceResult.device?.id, tokens.refreshToken, expiresAt);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        ...tokens,
        sessionId,
        device: deviceResult.device ? {
          id: deviceResult.device.id,
          name: deviceResult.device.device_name,
          type: deviceResult.device.device_type
        } : null
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Login with email/password
 * Enforces single active session and device limits
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, deviceFingerprint, deviceName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const db = getDb();
    const result = await db.query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Register/update device
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const fingerprint = deviceFingerprint || generateDeviceFingerprint(userAgent, ipAddress);

    const deviceResult = await registerDevice(user.id, {
      fingerprint,
      userAgent,
      ipAddress,
      deviceName
    });

    // Check device limit
    if (deviceResult.deviceLimitReached) {
      return res.status(403).json({
        success: false,
        error: 'device_limit_reached',
        message: `You have reached the maximum of ${MAX_DEVICES} devices. Please remove a device to continue.`,
        devices: deviceResult.existingDevices.map(d => ({
          id: d.id,
          name: d.device_name,
          type: d.device_type,
          lastUsed: d.last_used
        }))
      });
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const tokens = generateTokens({ ...user, source: 'local' });

    // Create session (this invalidates all previous sessions - single active session)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const sessionId = await createSession(user.id, deviceResult.device?.id, tokens.refreshToken, expiresAt);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        ...tokens,
        sessionId,
        device: deviceResult.device ? {
          id: deviceResult.device.id,
          name: deviceResult.device.device_name,
          type: deviceResult.device.device_type,
          isNew: deviceResult.isNew
        } : null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// =============================================================================
// WORDPRESS SSO
// =============================================================================

/**
 * POST /api/v1/auth/wordpress
 * Login via WordPress/AcademyLMS session
 */
router.post('/wordpress', async (req, res) => {
  try {
    const { wpToken } = req.body;

    if (!wpToken) {
      return res.status(400).json({
        success: false,
        error: 'WordPress token required'
      });
    }

    // Validate WordPress session
    const wpUser = await validateWordPressSession(wpToken);

    const db = getDb();

    // Check if user exists in our system
    let result = await db.query(
      'SELECT id, email, name, role FROM users WHERE wordpress_id = $1 OR email = $2',
      [wpUser.id, wpUser.email]
    );

    let user;

    if (result.rows.length === 0) {
      // Create new user from WordPress
      const userId = uuidv4();
      result = await db.query(
        `INSERT INTO users (id, email, name, role, wordpress_id, source, created_at)
         VALUES ($1, $2, $3, $4, $5, 'wordpress', NOW())
         RETURNING id, email, name, role`,
        [userId, wpUser.email, wpUser.displayName, wpUser.role || 'client', wpUser.id]
      );
      user = result.rows[0];
    } else {
      user = result.rows[0];
      // Update last login
      await db.query(
        'UPDATE users SET last_login = NOW(), wordpress_id = COALESCE(wordpress_id, $2) WHERE id = $1',
        [user.id, wpUser.id]
      );
    }

    // Generate tokens
    const tokens = generateTokens({ ...user, source: 'wordpress' });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          source: 'wordpress'
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('WordPress SSO error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'WordPress authentication failed'
    });
  }
});

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 * Validates session is still active (not logged out from another device)
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Validate session is still active
    const sessionCheck = await validateSession(decoded.userId, refreshToken);
    if (!sessionCheck.valid) {
      return res.status(401).json({
        success: false,
        error: 'session_invalidated',
        reason: sessionCheck.reason,
        message: sessionCheck.reason === 'session_invalid'
          ? 'Your session has been invalidated. You may have logged in from another device.'
          : 'Session expired'
      });
    }

    const db = getDb();
    const result = await db.query(
      'SELECT id, email, name, role, source FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    const tokens = generateTokens(user);

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const db = getDb();

    // Invalidate the session if refresh token provided
    if (refreshToken) {
      await db.query(
        'UPDATE sessions SET is_active = false WHERE user_id = $1 AND refresh_token = $2',
        [req.user.id, refreshToken]
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

// =============================================================================
// DEVICE MANAGEMENT
// =============================================================================

/**
 * GET /api/v1/auth/devices
 * Get all devices registered for the current user
 */
router.get('/devices', authenticateToken, async (req, res) => {
  try {
    const devices = await getUserDevices(req.user.id);

    res.json({
      success: true,
      data: {
        devices: devices.map(d => ({
          id: d.id,
          name: d.device_name,
          type: d.device_type,
          browser: d.browser,
          os: d.os,
          lastUsed: d.last_used,
          createdAt: d.created_at,
          hasActiveSession: d.has_active_session,
          isTrusted: d.is_trusted
        })),
        maxDevices: MAX_DEVICES
      }
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get devices'
    });
  }
});

/**
 * DELETE /api/v1/auth/devices/:deviceId
 * Remove a device (and invalidate its sessions)
 */
router.delete('/devices/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const result = await removeDevice(req.user.id, deviceId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Device removed successfully'
    });
  } catch (error) {
    console.error('Remove device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove device'
    });
  }
});

/**
 * GET /api/v1/auth/session-status
 * Check if current session is still valid
 */
router.get('/session-status', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.query;
    const db = getDb();

    if (sessionId) {
      const result = await db.query(
        'SELECT is_active FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: { active: false, reason: 'session_not_found' }
        });
      }

      return res.json({
        success: true,
        data: {
          active: result.rows[0].is_active,
          reason: result.rows[0].is_active ? null : 'logged_out_another_device'
        }
      });
    }

    res.json({
      success: true,
      data: { active: true }
    });
  } catch (error) {
    console.error('Session status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check session status'
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT id, email, name, role, source, birth_data, avatar_url,
              created_at, last_login, settings
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        source: user.source,
        birthData: user.birth_data,
        avatarUrl: user.avatar_url,
        settings: user.settings,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

export default router;
