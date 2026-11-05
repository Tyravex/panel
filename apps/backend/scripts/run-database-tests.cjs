// Prepare the dedicated Docker PostgreSQL instance before database integration tests.
// Never reset, drop, or copy data from the application database.
const { spawnSync } = require('node:child_process');
const { resolve, dirname, join } = require('node:path');
const { existsSync } = require('node:fs');
const dotenv = require('dotenv');

const backend = resolve(__dirname, '..');
const root = resolve(backend, '../..');
const composeFile = resolve(root, 'docker-compose.test.yml');
for (const file of [resolve(root, '.env'), resolve(backend, '.env')]) {
  if (existsSync(file)) dotenv.config({ path: file, override: false });
}

function fail(message) {
  console.error(`[test:database] ${message}`);
  process.exit(1);
}
function parseDatabase(value, label) {
  let url;
  try { url = new URL(value); } catch { fail(`${label} must be a valid URL.`); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) fail(`${label} must use PostgreSQL.`);
  return url;
}
function identity(url) {
  return [url.hostname.toLowerCase(), url.port || '5432', decodeURIComponent(url.pathname),
  url.searchParams.get('schema') || 'public'].join('|');
}
function run(command, args, env = process.env, cwd = backend) {
  // Execute binaries directly; never interpolate arguments into a shell command.
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) fail(`Unable to run ${command}: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status || 1);
}

const value = process.env.TEST_DATABASE_URL;
if (!value) fail('Set TEST_DATABASE_URL in the root or backend .env file.');
const test = parseDatabase(value, 'TEST_DATABASE_URL');
if (!['127.0.0.1', 'localhost'].includes(test.hostname) ||
  test.port !== '55433' || test.pathname !== '/tyravex_integration' ||
  test.username !== 'tyravex_test' || test.searchParams.get('schema') !== 'public') {
  fail('TEST_DATABASE_URL must target local tyravex_test@127.0.0.1:55433/tyravex_integration?schema=public.');
}
if (process.env.DATABASE_URL && identity(parseDatabase(process.env.DATABASE_URL, 'DATABASE_URL')) === identity(test)) {
  fail('TEST_DATABASE_URL and application DATABASE_URL must not target the same database/schema.');
}
if (!existsSync(composeFile)) fail(`Missing Docker Compose file: ${composeFile}`);

// Resolve the public package.json entry, then locate its installed CLI file.
// Directly resolving private package subpaths fails for packages using "exports".
function cli(packageName, relativeEntry) {
  let packageFile;
  try {
    packageFile = require.resolve(`${packageName}/package.json`);
  } catch (error) {
    fail(`Cannot resolve ${packageName} package: ${error.message}`);
  }
  const entry = join(dirname(packageFile), ...relativeEntry);
  if (!existsSync(entry)) fail(`Missing ${packageName} CLI entry: ${entry}`);
  return entry;
}

// Check both CLI paths before starting Docker or touching the test database.
const prismaCli = cli('prisma', ['build', 'index.js']);
const jestCli = cli('jest', ['bin', 'jest.js']);

console.log('[test:database] Starting isolated PostgreSQL via docker-compose.test.yml...');
run(process.platform === 'win32' ? 'docker.exe' : 'docker',
  ['compose', '-f', composeFile, 'up', '-d', '--wait', 'postgres-test'], process.env, root);

// Only child processes receive DATABASE_URL=test. The parent shell is not modified.
const testEnv = { ...process.env, DATABASE_URL: value, TYRAVEX_TEST_DATABASE_ACTIVE: '1' };
console.log('[test:database] Applying Prisma migrations to the test database...');
run(process.execPath, [prismaCli, 'migrate', 'deploy'], testEnv);
console.log('[test:database] Running PostgreSQL integration tests...');
run(process.execPath, [jestCli, '--config', 'jest.database.config.cjs', '--runInBand', ...process.argv.slice(2)], testEnv);
console.log('[test:database] Done. Test container remains running for inspection.');
