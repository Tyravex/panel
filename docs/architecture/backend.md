# Backend module structure

Stack: NestJS, Prisma/PostgreSQL, Redis/BullMQ.

## Existing organization

- `src/modules/<domain>`: NestJS controllers, DTOs, services and tests.
- `src/modules/services`: service drafts, ownership and membership.
- `src/modules/server`: legacy server functionality — do not delete prematurely.
- `src/modules/nodes/protocol` and `transport`: agent wire protocol and authenticated WebSocket.
- `src/modules/jobs`: existing dispatcher, worker and handler registry.
- `src/prisma`: existing NestJS Prisma module.
- `src/rbac`: existing RBAC module.
- `src/infrastructure`: shared infrastructure, including queue/Redis.
- `prisma/`: schema and migrations.

## Module boundaries

Controllers validate and authorize; services coordinate domain rules; repositories/Prisma persist state; workers run durable background tasks. Add `application/`, `domain/` or `repositories/` only when complexity justifies it. Never build a second queue, Prisma module, node transport or permissions layer merely for directory symmetry.

## Service lifecycle

Service installation must validate node assignment, resources and ownership/permissions; record an auditable state transition; enqueue work; deliver allowlisted operations to the authenticated Agent; and persist final results. Handle retries, idempotency, timeouts and node disconnections.

The existing agent protocol supports hello/welcome and heartbeat; it declares command message types and currently allows `server.start`, `server.stop`, `server.restart` payloads, but command dispatch is not complete. Do not present these operations as functional until integrated and tested.

## Testing

Run relevant Jest unit tests and backend build. Integration tests require the dedicated `tyravex_rbac_test` database; never point them at development or production data. See [Development](../development.md).
