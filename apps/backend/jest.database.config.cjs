// Only real PostgreSQL suites; excludes Redis, Go interop and mocked HTTP tests.
const { testRegex, ...base } = require('./package.json').jest;
module.exports = {
  ...base,
  rootDir: './src',
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: [
    '<rootDir>/modules/eggs/test/egg-postgres.integration.spec.ts',
    '<rootDir>/modules/auth/test/registration-settings.integration.spec.ts',
    '<rootDir>/modules/users/test/admin-users.audit.integration.spec.ts',
    '<rootDir>/rbac/test/rbac.integration.spec.ts',
    '<rootDir>/rbac/test/rbac.audit.integration.spec.ts',
    '<rootDir>/**/*.database.spec.ts',
  ],
};
