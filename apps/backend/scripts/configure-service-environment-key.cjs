const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

// Never print or replace an existing encryption key.
const target = path.resolve(__dirname, '../.env');
const contents = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
if (/^\s*SERVICE_ENVIRONMENT_KEY\s*=/m.test(contents)) {
  console.log('SERVICE_ENVIRONMENT_KEY already exists; preserved.');
} else {
  const key = randomBytes(32).toString('hex');
  fs.appendFileSync(target, `${contents.endsWith('\n') || !contents ? '' : '\n'}SERVICE_ENVIRONMENT_KEY=${key}\n`, { mode: 0o600 });
  console.log('SERVICE_ENVIRONMENT_KEY configured in the ignored backend .env; value not displayed.');
}
