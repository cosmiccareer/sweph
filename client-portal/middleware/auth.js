/**
 * Authentication Middleware
 * Handles JWT authentication and WordPress SSO integration
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// =============================================================================
// TOKEN GENERATION
// =============================================================================

/**
 * Generate access token
 */
export function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role || 'client',
      source: user.source || 'local' // 'local' or 'wordpress'
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );
}

/**
 * Generate token pair
 */
export function generateTokens(user) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
    expiresIn: JWT_EXPIRY
  };
}

// =============================================================================
// TOKEN VERIFICATION MIDDLEWARE
// =============================================================================

/**
 * Middleware to verify JWT token
 */
export function authenticateToken(req, res, next) {
  // Get token from header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      source: decoded.source
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(403).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Optional authentication - sets user if token present, but doesn't require it
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        source: decoded.source
      };
    } catch {
      // Token invalid, but continue without user
    }
  }

  next();
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Not a refresh token');
    }
    return decoded;
  } catch (error) {
    throw error;
  }
}

// =============================================================================
// WORDPRESS SSO HELPERS
// =============================================================================

/**
 * Validate WordPress session token
 * This integrates with your existing WordPress/AcademyLMS setup
 */
export async function validateWordPressSession(wpToken) {
  const wpSiteUrl = process.env.WORDPRESS_SITE_URL;
  const wpSecretKey = process.env.WORDPRESS_JWT_SECRET;

  if (!wpSiteUrl) {
    throw new Error('WordPress site URL not configured');
  }

  try {
    // Option 1: Validate JWT token directly if using a JWT plugin
    if (wpSecretKey && wpToken.includes('.')) {
      const decoded = jwt.verify(wpToken, wpSecretKey);
      return {
        id: decoded.data?.user?.id,
        email: decoded.data?.user?.email,
        displayName: decoded.data?.user?.display_name,
        source: 'wordpress'
      };
    }

    // Option 2: Call WordPress REST API to validate session
    const response = await fetch(`${wpSiteUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        'Authorization': `Bearer ${wpToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Invalid WordPress session');
    }

    const wpUser = await response.json();

    return {
      id: `wp_${wpUser.id}`,
      email: wpUser.email || wpUser.slug + '@wordpress.local',
      displayName: wpUser.name,
      role: mapWordPressRole(wpUser.roles),
      source: 'wordpress',
      avatarUrl: wpUser.avatar_urls?.['96']
    };
  } catch (error) {
    console.error('WordPress SSO validation failed:', error.message);
    throw new Error('WordPress authentication failed');
  }
}

/**
 * Map WordPress roles to portal roles
 */
function mapWordPressRole(wpRoles = []) {
  if (wpRoles.includes('administrator')) return 'admin';
  if (wpRoles.includes('editor') || wpRoles.includes('instructor')) return 'instructor';
  if (wpRoles.includes('subscriber') || wpRoles.includes('student')) return 'client';
  return 'client';
}

/**
 * Check if user has active course enrollment
 * Integrates with AcademyLMS
 */
export async function checkCourseEnrollment(userId, courseId = null) {
  const wpSiteUrl = process.env.WORDPRESS_SITE_URL;

  if (!wpSiteUrl) {
    // If no WordPress integration, assume enrolled
    return { enrolled: true, progress: 0 };
  }

  try {
    // This would call your AcademyLMS API
    // Example endpoint - adjust based on your AcademyLMS configuration
    const endpoint = courseId
      ? `${wpSiteUrl}/wp-json/academy/v1/enrollments/${userId}/${courseId}`
      : `${wpSiteUrl}/wp-json/academy/v1/enrollments/${userId}`;

    const response = await fetch(endpoint, {
      headers: {
        'X-API-Key': process.env.WORDPRESS_API_KEY || ''
      }
    });

    if (!response.ok) {
      return { enrolled: false, progress: 0 };
    }

    const enrollment = await response.json();

    return {
      enrolled: true,
      courseId: enrollment.course_id,
      progress: enrollment.progress || 0,
      startDate: enrollment.start_date,
      status: enrollment.status
    };
  } catch (error) {
    console.error('Enrollment check failed:', error.message);
    return { enrolled: false, progress: 0, error: error.message };
  }
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  authenticateToken,
  optionalAuth,
  requireRole,
  verifyRefreshToken,
  validateWordPressSession,
  checkCourseEnrollment
};
