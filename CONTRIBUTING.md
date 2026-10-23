# Contributing to Tyravex

Thank you for your interest in contributing to Tyravex.

We welcome contributions to the application, documentation, translations, tests, and developer tooling.

## Before You Start

1. Review the [project README](README.md) and available documentation.
2. Read the [Architecture Overview](docs/architecture/README.md), [Repository Structure](docs/architecture/repository-structure.md), and [Module Rules](docs/architecture/module-rules.md).
3. Check existing issues and pull requests to avoid duplicate work.
4. For significant changes, open an issue to discuss the proposal before implementation.
5. Follow the project's [Security Policy](SECURITY.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Setup

The Tyravex Panel is a TypeScript monorepo managed with pnpm. The official [Go Node Agent](https://github.com/Tyravex/agent) is maintained in a separate repository; the legacy TypeScript Agent has been removed from the Panel workspace.

Refer to the [Development Guide](docs/development.md) for local setup, database migrations, tests, and builds. See [Configuration](docs/configuration.md) for environment settings.

When moving existing files or splitting modules, follow the [Migration Guide](docs/architecture/migration.md). Preserve routes, authorization, translations, and API compatibility unless a change is explicitly intended and documented.

## Branch Naming

Use descriptive branch names, for example:

- `feat/server-console`
- `fix/auth-refresh`
- `docs/linux-installation`
- `refactor/frontend-layout`
- `test/permissions`

## Commit Messages

Prefer clear, focused commit messages.

Examples:

- `feat: add server console interface`
- `fix: correct refresh token validation`
- `docs: update installation guide`
- `refactor: simplify navigation layout`

## Pull Requests

Each pull request should:

- Address one focused change whenever possible.
- Explain what changed and why.
- Link related issues.
- Include testing instructions and relevant results.
- Update documentation when behavior changes.
- Avoid unrelated formatting or refactoring.
- Never include secrets, credentials, or production data.

Use the pull request template when opening a PR.

## Code Guidelines

- Use TypeScript for Panel application code and Go for changes to the separate Node Agent repository.
- Follow existing naming conventions and documented module boundaries.
- Keep frontend, backend, and shared packages separated.
- Avoid duplicate implementations of existing functionality.
- Validate inputs and enforce authorization on the backend.
- Preserve existing routes, API contracts, and supported translations when refactoring.
- Prefer additive, backward-compatible database migrations.
- Add tests for security-sensitive and critical functionality.
- Keep changes small enough to review and verify independently.

## Database Changes

When changing Prisma models:

1. Explain the purpose of the schema change.
2. Include the appropriate migration.
3. Consider existing installations and data.
4. Avoid destructive migrations unless explicitly discussed and approved.
5. Verify the migration targets the intended database, not a production or unrelated test database.

## Plugin Contributions

The plugin SDK and compatibility policy are still under development.

Do not rely on undocumented internal APIs as stable plugin interfaces. See [Plugin Documentation](docs/plugins.md) for the current status.

## Reporting Bugs

Use the GitHub bug report template and include:

- Relevant application version or commit.
- Steps to reproduce.
- Expected and actual behavior.
- Sanitized logs or screenshots.

Never post access tokens, passwords, private keys, or other sensitive information.

## Security Vulnerabilities

Do not report security vulnerabilities in public issues.

Follow [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## Licensing

By submitting a contribution, you agree that your contribution may be distributed under the project's AGPL-3.0 license.

You must have the necessary rights to submit your contribution. Do not copy third-party code without checking its license and attribution requirements.

## Community

All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
