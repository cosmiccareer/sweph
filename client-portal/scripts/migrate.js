/**
 * Database Migration Script
 * Run: node scripts/migrate.js
 */

import { initDb, runMigrations, closeDb } from '../services/database.js';

async function main() {
  console.log('Starting database migration...');

  try {
    initDb();
    await runMigrations();
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
