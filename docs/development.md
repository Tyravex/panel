# Development Guide

## Status

Tyravex is in early development and is not yet production-ready.

This guide describes the current local development workflow.

## Technology

The Tyravex monorepo uses:

- TypeScript
- React and Vite
- NestJS
- PostgreSQL
- Prisma
- Redis and BullMQ
- pnpm workspaces

## Prerequisites

Install:

- Git
- Node.js compatible with the project's dependencies
- pnpm
- Docker Engine or Docker Desktop with Docker Compose

Use the dependency versions and lockfile provided by the repository.

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

## Environment Configuration

The repository contains two example environment files:

- `.env.example` — repository-level settings, including Docker Compose.
- `apps/backend/.env.example` — backend-specific settings.

Create local environment files from the examples and replace placeholder credentials and secrets.

Do not commit populated `.env` files.

For Docker Compose, the root `.env` must define `POSTGRES_PASSWORD`. The backend `DATABASE_URL` must use matching PostgreSQL credentials.

See [Configuration](configuration.md) for environment variable details.

## Install Dependencies

From the repository root:

```powershell
pnpm install
```

## Local Infrastructure

The root `docker-compose.yml` provides PostgreSQL and Redis for development.

After configuring the local root `.env` file, start the infrastructure:

```powershell
docker compose up -d postgres redis
```

Check container status:

```powershell
docker compose ps
```

Default local endpoints:

| Service | Address |
|---|---|
| PostgreSQL | `127.0.0.1:5433` |
| Redis | `127.0.0.1:6380` |

The Compose file does not currently deploy the Tyravex backend or frontend.

## Prisma

The backend uses Prisma 7 with configuration in:

`apps/backend/prisma.config.ts`

Ensure the backend environment provides a valid `DATABASE_URL` before running Prisma commands.

Prisma commands run in the backend workspace. Configure `apps/backend/.env` with the intended development database URL, or provide `DATABASE_URL` explicitly in the command environment. The root `.env` is used by Docker Compose and must not be assumed to configure Prisma automatically.

Generate the Prisma client:

```powershell
pnpm --filter ./apps/backend prisma:generate
```

Apply development migrations:

```powershell
pnpm --filter ./apps/backend prisma:migrate
```

Development migrations must target the intended development database, never an unrelated production database.

## Start the Applications

From the repository root, start the backend:

```powershell
pnpm dev:backend
```

In another terminal, start the frontend:

```powershell
pnpm dev:frontend
```

The backend uses port `3000` by default.

The frontend development configuration uses port `5173` in the example CORS origin.

## Background Jobs

Redis is optional for basic backend startup, but queue operations require Redis.

The BullMQ queue name is currently fixed to:

`server-operations`

Keep:

```dotenv
JOB_WORKER_ENABLED=false
```

Do not enable the worker until all required server-operation handlers are implemented.

## Backend Tests

Run the standard backend test suite from the repository root:

```powershell
pnpm --filter ./apps/backend test --runInBand
```

This command excludes integration tests by default.

Run the backend build:

```powershell
pnpm --filter ./apps/backend build
```

## Integration Test Isolation

Integration tests require a dedicated PostgreSQL database named exactly:

`tyravex_rbac_test`

Never run integration tests against the normal application database `tyravex`.

The dedicated Redis test endpoint is:

`redis://127.0.0.1:6381`

The regular Compose configuration does not create this separate Redis test instance.

Before running integration tests, verify that the dedicated test database and test services are configured correctly.

The backend defines a separate `test:integration` script. Do not run it with the normal development `DATABASE_URL`.

## Development Workflow

1. Make focused changes.
2. Run the relevant tests.
3. Run the backend build when backend code changes.
4. Review the Git diff.
5. Stage only the intended files.
6. Commit and push after verification.

Useful Git checks:

```powershell
git diff --check
git diff --stat
git status --short
```

Do not use `git add .` when unrelated or sensitive files may be present.

## Security

- Use development-only credentials locally.
- Never commit real secrets, populated `.env` files or private keys.
- Do not expose PostgreSQL or Redis unnecessarily.
- Never run integration tests against the application database.
- Keep the BullMQ worker disabled until its handlers are ready.
- Do not treat a successful build as proof of production readiness.
