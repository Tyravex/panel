# Contributing to Tyravex

Thank you for your interest in contributing to Tyravex.

We welcome contributions to the application, documentation, translations, tests, and developer tooling.

## Before You Start

1. Review the README and available documentation.
2. Check existing issues and pull requests to avoid duplicate work.
3. For significant changes, open an issue to discuss the proposal before implementation.
4. Follow the project's security and community guidelines.

## Development Setup

Tyravex uses a TypeScript monorepo with pnpm.

Once the application source is published, refer to [Development Documentation](docs/development.md) for verified setup commands.

## Branch Naming

Use descriptive branch names:

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
- Include testing instructions.
- Update documentation when behavior changes.
- Avoid unrelated formatting or refactoring.
- Never include secrets, credentials, or production data.

Use the pull request template when opening a PR.

## Code Guidelines

- Use TypeScript for application code.
- Follow existing naming conventions and module boundaries.
- Keep frontend, backend, and shared packages separated.
- Avoid introducing duplicate implementations of existing functionality.
- Validate inputs and enforce authorization on the backend.
- Prefer additive, backward-compatible database migrations.
- Add tests for security-sensitive and critical functionality.

## Database Changes

When changing Prisma models:

1. Explain the purpose of the schema change.
2. Include the appropriate migration.
3. Consider existing installations and data.
4. Avoid destructive migrations unless explicitly discussed and approved.

## Plugin Contributions

The plugin SDK and compatibility policy are still under development.

Do not rely on undocumented internal APIs as stable plugin interfaces.

## Reporting Bugs

Use the GitHub bug report template and include:

- Relevant application version or commit
- Steps to reproduce
- Expected and actual behavior
- Sanitized logs or screenshots

Never post access tokens, passwords, private keys, or other sensitive information.

## Security Vulnerabilities

Do not report security vulnerabilities in public issues.

Follow [SECURITY.md](SECURITY.md).

## Licensing

By submitting a contribution, you agree that your contribution may be distributed under the project's AGPL-3.0 license.

You must have the necessary rights to submit your contribution. Do not copy third-party code without checking its license and attribution requirements.

## Community

All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).