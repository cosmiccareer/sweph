/**
 * Session Manager Service
 * Handles single active session enforcement and device limits
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from './database.js';

const MAX_DEVICES = 3;

/**
 * Parse user agent to extract device info
 */
export function parseUserAgent(userAgent = '') {
  const ua = userAgent.toLowerCase();

  let deviceType = 'desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }

  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('linux') && !ua.includes('android')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return { deviceType, browser, os };
}

/**
 * Generate device fingerprint from available info
 */
export function generateDeviceFingerprint(userAgent, ipAddress, clientFingerprint = null) {
  // Use client-provided fingerprint if available, otherwise generate from UA + IP
  if (clientFingerprint) {
    return clientFingerprint;
  }

  const { browser, os } = parseUserAgent(userAgent);
  // Create a simple fingerprint - in production, use a proper fingerprinting library
  const fingerprintBase = `${browser}-${os}-${ipAddress}`;
  return Buffer.from(fingerprintBase).toString('base64').substring(0, 32);
}

/**
 * Register or update a device for a user
 * Returns { device, isNew, deviceLimitReached }
 */
export async function registerDevice(userId, deviceInfo) {
  const db = getDb();
  const { fingerprint, userAgent, ipAddress, deviceName } = deviceInfo;
  const { deviceType, browser, os } = parseUserAgent(userAgent);

  // Check existing devices for this user
  const existingDevices = await db.query(
    'SELECT * FROM user_devices WHERE user_id = $1 ORDER BY last_used DESC',
    [userId]
  );

  // Check if this device already exists
  const existingDevice = existingDevices.rows.find(d => d.device_fingerprint === fingerprint);

  if (existingDevice) {
    // Update existing device
    await db.query(
      `UPDATE user_devices SET
        last_used = NOW(),
        ip_address = $2,
        device_name = COALESCE($3, device_name)
      WHERE id = $1`,
      [existingDevice.id, ipAddress, deviceName]
    );
    return { device: existingDevice, isNew: false, deviceLimitReached: false };
  }

  // Check device limit
  if (existingDevices.rows.length >= MAX_DEVICES) {
    return {
      device: null,
      isNew: false,
      deviceLimitReached: true,
      existingDevices: existingDevices.rows
    };
  }

  // Create new device
  const deviceId = uuidv4();
  const result = await db.query(
    `INSERT INTO user_devices (id, user_id, device_fingerprint, device_name, device_type, browser, os, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [deviceId, userId, fingerprint, deviceName || `${browser} on ${os}`, deviceType, browser, os, ipAddress]
  );

  return { device: result.rows[0], isNew: true, deviceLimitReached: false };
}

/**
 * Create a new session and invalidate all previous sessions (single active session)
 */
export async function createSession(userId, deviceId, refreshToken, expiresAt) {
  const db = getDb();

  // Invalidate all previous active sessions for this user
  await db.query(
    `UPDATE sessions SET is_active = false WHERE user_id = $1 AND is_active = true`,
    [userId]
  );

  // Create new session
  const sessionId = uuidv4();
  await db.query(
    `INSERT INTO sessions (id, user_id, device_id, refresh_token, expires_at, is_active)
     VALUES ($1, $2, $3, $4, $5, true)`,
    [sessionId, userId, deviceId, refreshToken, expiresAt]
  );

  return sessionId;
}

/**
 * Validate a session is still active
 */
export async function validateSession(userId, refreshToken) {
  const db = getDb();

  const result = await db.query(
    `SELECT s.*, d.device_name, d.device_type
     FROM sessions s
     LEFT JOIN user_devices d ON s.device_id = d.id
     WHERE s.user_id = $1 AND s.refresh_token = $2 AND s.is_active = true AND s.expires_at > NOW()`,
    [userId, refreshToken]
  );

  if (result.rows.length === 0) {
    return { valid: false, reason: 'session_invalid' };
  }

  // Update last activity
  await db.query(
    `UPDATE sessions SET last_activity = NOW() WHERE id = $1`,
    [result.rows[0].id]
  );

  return { valid: true, session: result.rows[0] };
}

/**
 * Check if user's session was invalidated (logged out from another device)
 */
export async function checkSessionStatus(userId, sessionId) {
  const db = getDb();

  const result = await db.query(
    `SELECT is_active, expires_at FROM sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  if (result.rows.length === 0) {
    return { active: false, reason: 'session_not_found' };
  }

  const session = result.rows[0];

  if (!session.is_active) {
    return { active: false, reason: 'logged_out_another_device' };
  }

  if (new Date(session.expires_at) < new Date()) {
    return { active: false, reason: 'session_expired' };
  }

  return { active: true };
}

/**
 * Invalidate a specific session
 */
export async function invalidateSession(sessionId) {
  const db = getDb();
  await db.query(
    `UPDATE sessions SET is_active = false WHERE id = $1`,
    [sessionId]
  );
}

/**
 * Get all devices for a user
 */
export async function getUserDevices(userId) {
  const db = getDb();
  const result = await db.query(
    `SELECT d.*,
      (SELECT COUNT(*) FROM sessions s WHERE s.device_id = d.id AND s.is_active = true) > 0 as has_active_session
     FROM user_devices d
     WHERE d.user_id = $1
     ORDER BY d.last_used DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Remove a device (and invalidate its sessions)
 */
export async function removeDevice(userId, deviceId) {
  const db = getDb();

  // Verify device belongs to user
  const device = await db.query(
    'SELECT * FROM user_devices WHERE id = $1 AND user_id = $2',
    [deviceId, userId]
  );

  if (device.rows.length === 0) {
    return { success: false, error: 'Device not found' };
  }

  // Invalidate all sessions for this device
  await db.query(
    'UPDATE sessions SET is_active = false WHERE device_id = $1',
    [deviceId]
  );

  // Remove the device
  await db.query(
    'DELETE FROM user_devices WHERE id = $1',
    [deviceId]
  );

  return { success: true };
}

/**
 * Get active session count for user
 */
export async function getActiveSessionCount(userId) {
  const db = getDb();
  const result = await db.query(
    'SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  return parseInt(result.rows[0].count);
}

export default {
  parseUserAgent,
  generateDeviceFingerprint,
  registerDevice,
  createSession,
  validateSession,
  checkSessionStatus,
  invalidateSession,
  getUserDevices,
  removeDevice,
  getActiveSessionCount,
  MAX_DEVICES
};
