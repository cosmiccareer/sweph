/**
 * Authentication Routes
 * Handles user registration, login, and session management
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
    const { email, password, name, birthData } = req.body;

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

    // Generate tokens
    const tokens = generateTokens(user);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        ...tokens
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
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

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

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const tokens = generateTokens({ ...user, source: 'local' });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        ...tokens
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
 * Logout user (invalidate token on client side)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  // In a production system, you'd add the token to a blacklist
  // For now, we just return success (client should discard tokens)
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
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
