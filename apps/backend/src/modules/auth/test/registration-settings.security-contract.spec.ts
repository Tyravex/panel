// Future security contract. These are intentionally pending until the
// persistent registration setting and protected admin API are implemented.
// Do not replace these with mock-only passing tests: they must exercise
// the real controller, guards, persistence and audit integration.
describe('Registration settings - future security contract', () => {
    it.todo('defaults public registration to disabled when no setting exists');
    it.todo('rejects anonymous POST /auth/register while registration is disabled');
    it.todo('allows valid public registration only when the stored setting is enabled');
    it.todo('ignores client-provided flags attempting to bypass the stored setting');
    it.todo('exposes only a safe registration-enabled boolean to anonymous clients');
    it.todo('rejects unauthenticated attempts to change the registration setting');
    it.todo('rejects authenticated users without user:manage permission');
    it.todo('allows authorized admins to enable and disable registration');
    it.todo('rejects non-boolean setting values and unknown write fields');
    it.todo('persists changes across application restarts');
    it.todo('records successful setting changes in the admin audit log');
    it.todo('does not alter the independent admin user-creation workflow');
    it.todo('fails closed if the registration setting cannot be read');
});
