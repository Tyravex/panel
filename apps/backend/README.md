# Tyravex Backend

NestJS + Prisma API for the Tyravex hosting panel. PostgreSQL stores persistent data; Redis/BullMQ provides background jobs.

## Structure

- `src/modules` — auth, users, services, legacy server, nodes, jobs and other business modules.
- `src/prisma` — existing Prisma NestJS module.
- `src/rbac` — authorization infrastructure.
- `src/infrastructure` — queue/Redis integrations.
- `prisma` — database schema and migrations.

Read [Backend architecture](../../docs/architecture/backend.md) and [module rules](../../docs/architecture/module-rules.md) before editing.

## Development

From the repository root:

```powershell
pnpm install
pnpm dev:backend
```

Unit tests and build:

```powershell
pnpm --filter ./apps/backend test --runInBand
pnpm --filter ./apps/backend build
```

Integration tests require the isolated `tyravex_rbac_test` database. Do **not** use the normal development database for integration tests.

See [Development](../../docs/development.md) and [Configuration](../../docs/configuration.md).
