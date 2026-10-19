# Configuration

Tyravex uses environment variables for backend configuration.

> Tyravex is in early development and is not yet production-ready.

## Example configuration files

- `.env.example` — repository-level example, including Docker Compose and frontend variables.
- `apps/backend/.env.example` — backend-specific example.

These files are templates. Never commit populated `.env` files or real secrets.

## Backend environment variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No | `development`, `test` or `production`. |
| `PORT` | No | Backend HTTP port. Defaults to `3000`; valid range is 1–65535. |
| `DATABASE_URL` | Yes | PostgreSQL connection URL using `postgresql://` or `postgres://`. |
| `REDIS_URL` | No* | Redis connection URL using `redis://` or `rediss://`. |
| `JOB_WORKER_ENABLED` | No | `true` or `false`. The worker is disabled unless explicitly enabled. |
| `JWT_SECRET` | Yes | Access-token signing secret. |
| `JWT_REFRESH_SECRET` | Yes | Refresh-token signing secret; must differ from `JWT_SECRET`. |
| `CORS_ORIGIN` | See source | Allowed frontend origin configuration. |

*Redis is required when `JOB_WORKER_ENABLED=true`. Without Redis, queue operations are unavailable and registration rate limiting fails closed.

Production JWT secrets must each contain at least 32 UTF-8 bytes and must not be obvious placeholders.

## BullMQ worker

The producer and worker currently use the fixed queue name `server-operations`.

`QUEUE_NAME` is not a supported backend configuration variable.

Keep `JOB_WORKER_ENABLED=false` during development until all required server-operation handlers are implemented. The worker refuses to start when required handlers are missing.

## Docker Compose infrastructure

The repository's root `docker-compose.yml` currently defines PostgreSQL and Redis infrastructure only. It is not a complete production deployment of Tyravex.

The Compose configuration uses:

- `POSTGRES_USER` — defaults to `tyravex`.
- `POSTGRES_PASSWORD` — required; supply a local value.
- `POSTGRES_DB` — defaults to `tyravex`.

For local development, PostgreSQL is published at `127.0.0.1:5433` and Redis at `127.0.0.1:6380`.

Docker Compose reads variables for interpolation from the shell, an explicitly selected environment file, or the project-level `.env` file according to Compose precedence rules.

The backend's `DATABASE_URL` must use credentials and a database name matching the configured PostgreSQL instance.

## Integration test isolation

PostgreSQL integration tests must use the isolated database:

`tyravex_rbac_test`

Never point integration tests at the normal application database `tyravex`.

The dedicated Redis test endpoint is:

`redis://127.0.0.1:6381`

Do not use the application Redis instance for integration tests.

## Frontend and CORS

The repository-level example contains:

- `VITE_API_URL=http://localhost:3000`
- `CORS_ORIGIN=http://localhost:5173`

Configure frontend and backend origins consistently. Use HTTPS and an appropriate reverse proxy for any future supported production deployment.

## Security

- Never commit populated `.env` files, private keys or real credentials.
- Generate strong, unique authentication secrets.
- Do not reuse access-token and refresh-token secrets.
- Restrict PostgreSQL and Redis network access.
- Do not expose the Docker socket to the public internet.
- Review environment settings before starting the backend.

## Deployment status

Tyravex is not yet production-ready. The current Compose file is intended for local infrastructure development, not complete panel deployment.
