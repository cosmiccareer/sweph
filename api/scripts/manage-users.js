#!/usr/bin/env node
/**
 * User Code Management CLI
 *
 * Usage:
 *   node manage-users.js list                    - List all user codes
 *   node manage-users.js add <email> <name> [tier]  - Add new user
 *   node manage-users.js disable <code>          - Disable a user code
 *   node manage-users.js enable <code>           - Re-enable a user code
 *   node manage-users.js generate               - Generate a random code
 */

const fs = require('fs');
const path = require('path');

const USER_CODES_FILE = path.join(__dirname, '../data/user-codes.json');

const TIERS = {
  free: { dailyLimit: 100, description: '100 requests/day' },
  basic: { dailyLimit: 500, description: '500 requests/day' },
  premium: { dailyLimit: 2000, description: '2000 requests/day' },
  unlimited: { dailyLimit: -1, description: 'Unlimited requests' }
};

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(USER_CODES_FILE, 'utf8'));
  } catch {
    return { users: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(USER_CODES_FILE, JSON.stringify(data, null, 2));
}

function generateCode(prefix = 'COSMO') {
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

function listUsers() {
  const data = loadData();
  const users = Object.entries(data.users);

  if (users.length === 0) {
    console.log('No user codes found.');
    return;
  }

  console.log('\nUser Codes:\n');
  console.log('CODE                  | NAME            | TIER      | LIMIT    | STATUS   | CREATED');
  console.log('----------------------|-----------------|-----------|----------|----------|----------');

  for (const [code, user] of users) {
    const status = user.enabled ? 'Active' : 'Disabled';
    const limit = user.dailyLimit === -1 ? 'Unlimited' : `${user.dailyLimit}/day`;
    console.log(
      `${code.padEnd(21)} | ${(user.name || 'N/A').padEnd(15)} | ${(user.tier || 'free').padEnd(9)} | ${limit.padEnd(8)} | ${status.padEnd(8)} | ${user.createdAt || 'N/A'}`
    );
  }
  console.log('');
}

function addUser(email, name, tier = 'free') {
  if (!email || !name) {
    console.error('Usage: node manage-users.js add <email> <name> [tier]');
    console.error('Tiers: free, basic, premium, unlimited');
    process.exit(1);
  }

  if (!TIERS[tier]) {
    console.error(`Invalid tier: ${tier}`);
    console.error('Valid tiers: free, basic, premium, unlimited');
    process.exit(1);
  }

  const data = loadData();
  const code = generateCode();

  data.users[code] = {
    name,
    email,
    tier,
    dailyLimit: TIERS[tier].dailyLimit,
    enabled: true,
    createdAt: new Date().toISOString().split('T')[0],
    notes: ''
  };

  saveData(data);

  console.log('\n✅ User code created successfully!\n');
  console.log(`   Code:  ${code}`);
  console.log(`   Name:  ${name}`);
  console.log(`   Email: ${email}`);
  console.log(`   Tier:  ${tier} (${TIERS[tier].description})`);
  console.log('\n   Send this code to the customer.\n');
}

function disableUser(code) {
  if (!code) {
    console.error('Usage: node manage-users.js disable <code>');
    process.exit(1);
  }

  const data = loadData();

  if (!data.users[code]) {
    console.error(`User code not found: ${code}`);
    process.exit(1);
  }

  data.users[code].enabled = false;
  saveData(data);

  console.log(`\n✅ User code ${code} has been disabled.\n`);
}

function enableUser(code) {
  if (!code) {
    console.error('Usage: node manage-users.js enable <code>');
    process.exit(1);
  }

  const data = loadData();

  if (!data.users[code]) {
    console.error(`User code not found: ${code}`);
    process.exit(1);
  }

  data.users[code].enabled = true;
  saveData(data);

  console.log(`\n✅ User code ${code} has been enabled.\n`);
}

function showHelp() {
  console.log(`
User Code Management CLI

Usage:
  node manage-users.js <command> [options]

Commands:
  list                       List all user codes
  add <email> <name> [tier]  Add a new user code
  disable <code>             Disable a user code
  enable <code>              Re-enable a user code
  generate                   Generate a random code (doesn't save)

Tiers:
  free      - 100 requests/day (default)
  basic     - 500 requests/day
  premium   - 2000 requests/day
  unlimited - No daily limit

Examples:
  node manage-users.js list
  node manage-users.js add john@example.com "John Doe" basic
  node manage-users.js disable COSMO-XXXX-XXXX
`);
}

// Main
const [,, command, ...args] = process.argv;

switch (command) {
  case 'list':
    listUsers();
    break;
  case 'add':
    addUser(args[0], args[1], args[2]);
    break;
  case 'disable':
    disableUser(args[0]);
    break;
  case 'enable':
    enableUser(args[0]);
    break;
  case 'generate':
    console.log(`\nGenerated code: ${generateCode()}\n`);
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  default:
    showHelp();
}
