#!/usr/bin/env node
// Prints the SHA-256 hash of a password for use as LOGIN_HASH in Login.jsx.
// Usage: node tools/hash-password.mjs your-password
import { createHash } from 'crypto';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node tools/hash-password.mjs <password>');
  process.exit(1);
}
const hash = createHash('sha256').update(pw).digest('hex');
console.log('SHA-256 hash:');
console.log(hash);
console.log('\nPortfolio ID (first 32 chars):');
console.log(hash.slice(0, 32));
