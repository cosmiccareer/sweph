/**
 * Database Service
 * PostgreSQL connection and query helpers
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool = null;

/**
 * Initialize database connection pool
 */
export function initDb() {
  if (pool) return pool;

  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'ccbbb_portal',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 10, // Maximum connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });

  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
  });

  console.log('Database pool initialized');
  return pool;
}

/**
 * Get database pool
 */
export function getDb() {
  if (!pool) {
    initDb();
  }
  return pool;
}

/**
 * Close database connections
 */
export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connections closed');
  }
}

/**
 * Run database migrations
 */
export async function runMigrations() {
  const db = getDb();

  const migrations = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'client',
      source VARCHAR(50) DEFAULT 'local',
      wordpress_id VARCHAR(100),
      birth_data JSONB,
      astrology_cache JSONB,
      cache_updated_at TIMESTAMP,
      avatar_url TEXT,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      last_login TIMESTAMP
    )`,

    // User progress table
    `CREATE TABLE IF NOT EXISTS user_progress (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id VARCHAR(100) NOT NULL,
      status VARCHAR(50) DEFAULT 'not_started',
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      notes TEXT,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, module_id)
    )`,

    // User documents table
    `CREATE TABLE IF NOT EXISTS user_documents (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id VARCHAR(100) NOT NULL,
      document_id VARCHAR(100) NOT NULL,
      document_name VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Chat messages table
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      context JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // User devices table (for device limiting) - must come before sessions
    `CREATE TABLE IF NOT EXISTS user_devices (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_fingerprint VARCHAR(255) NOT NULL,
      device_name VARCHAR(255),
      device_type VARCHAR(50),
      browser VARCHAR(100),
      os VARCHAR(100),
      ip_address VARCHAR(45),
      last_used TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      is_trusted BOOLEAN DEFAULT false,
      UNIQUE(user_id, device_fingerprint)
    )`,

    // Sessions table (for refresh token management)
    `CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token TEXT NOT NULL,
      device_id UUID REFERENCES user_devices(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT true,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      last_activity TIMESTAMP DEFAULT NOW()
    )`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_users_wordpress_id ON users(wordpress_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_documents_user ON user_documents(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active) WHERE is_active = true`,
    `CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint ON user_devices(device_fingerprint)`
  ];

  console.log('Running database migrations...');

  for (const migration of migrations) {
    try {
      await db.query(migration);
    } catch (error) {
      console.error('Migration error:', error.message);
      throw error;
    }
  }

  console.log('Migrations completed successfully');
}

export default {
  initDb,
  getDb,
  closeDb,
  runMigrations
};
