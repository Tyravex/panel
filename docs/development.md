# Development Guide

## Status

This guide is preliminary. Verified setup commands will be added after the application source and package scripts are published.

## Technology

The Tyravex monorepo uses:

- TypeScript
- React and Vite
- NestJS
- PostgreSQL
- Prisma
- pnpm workspaces

## Prerequisites

You will need:

- Git
- A supported Node.js version
- pnpm
- PostgreSQL
- Docker for container-related development

Exact supported versions will be documented after the build configuration is finalized.

## Repository Structure

```text
apps/
  frontend/
  backend/
packages/
  types/
docs/
.github/
```

## Getting Started

1. Clone the repository.
2. Install the required development tools.
3. Copy `.env.example` to a local `.env` file.
4. Configure the database connection and development secrets.
5. Install workspace dependencies.
6. Apply the required Prisma migrations.
7. Start the backend and frontend development servers.

Exact commands will be added once validated against the source code.

## Development Workflow

Create a feature branch, make focused changes, test locally, and open a pull request.

Follow [CONTRIBUTING.md](../CONTRIBUTING.md).

## Code Organization

Keep application responsibilities separated:

- Frontend UI and client-side state belong in the frontend application.
- API validation, authorization, and business logic belong in the backend.
- Shared contracts belong in shared packages.
- Docker lifecycle operations should be handled by the designated node-management layer.

## Testing

Automated linting, testing, and build verification will be introduced through GitHub Actions.

Do not assume a change is production-ready solely because it builds successfully.

## Security

Use development-only credentials locally.

Never commit populated environment files, database dumps containing real data, or private keys.