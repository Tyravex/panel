# Tyravex

Tyravex is an open-source hosting control panel for game servers, Discord/Telegram bots and containerized applications.

> **Status:** Early development. Not production-ready.

## Repositories

- **[Tyravex/panel](https://github.com/Tyravex/panel):** React, TypeScript, Vite, NestJS, Prisma, PostgreSQL and Redis/BullMQ.
- **[Tyravex/agent](https://github.com/Tyravex/agent):** separate Go daemon for hosting nodes, WebSocket heartbeat and Docker diagnostics.

The canonical Node Agent lives in its **own Go repository**. The previous TypeScript scaffold was removed from the Panel in commit [`c0c9eff`](https://github.com/Tyravex/panel/commit/c0c9eff).

## Documentation

Start at **[Documentation index](docs/README.md)**.

- [Architecture and modularity](docs/architecture/README.md)
- [Repository structure](docs/architecture/repository-structure.md)
- [Module rules](docs/architecture/module-rules.md)
- [Migration plan](docs/architecture/migration.md)
- [Development](docs/development.md)
- [Configuration](docs/configuration.md)
- [Plugins](docs/plugins.md)
- [Linux installation](docs/installation/linux.md)
- [Docker installation](docs/installation/docker.md)

**Contributors:** Read [the module rules](docs/architecture/module-rules.md) before changing code.

## Current capabilities

Authentication and RBAC, service drafts and ownership, node registration and authenticated WebSocket heartbeat, notifications, localization (PL/EN/DE) and background-jobs infrastructure.

**Not yet complete:** end-to-end service installation, command execution on the Go agent, production Docker provisioning and production deployment.

## Development

See [the development guide](docs/development.md) for prerequisites, environment variables, commands, tests and database isolation.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Never commit secrets or expose node credentials.
