# Tyravex

**Tyravex** is an open-source server management panel designed to provide a modern, flexible interface for managing game servers, Discord bots, and other containerized applications.

Tyravex aims to combine an intuitive user experience with a modular architecture, extensibility, and reliable Docker-based server management.

> **Project status:** Early development. Tyravex is not yet production-ready.

## Features

### Core platform
- Modern web dashboard
- User authentication and account management
- Role-based access control
- Server management interface
- Notifications
- Multi-language support
- Light and dark themes

### Planned capabilities
- Docker-based server provisioning and lifecycle management
- Remote nodes managed through a dedicated Node Agent
- Real-time server console and resource monitoring
- Server templates for games, bots, and applications
- Plugin and extension system
- Administrative settings and branding
- Linux and Docker Compose installation options

Features listed as planned may change during development.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Container runtime | Docker |
| Package management | pnpm |
| Node management | Dedicated Node Agent (planned) |

## Architecture

Tyravex is designed around a modular architecture:

- **Frontend:** The web interface used by administrators and server owners.
- **Backend:** Authentication, permissions, API endpoints, and business logic.
- **Database:** Persistent application data.
- **Node Agent:** A separate service responsible for managing Docker workloads on remote machines.
- **Plugin system:** An extensibility layer for additional functionality.

See [Architecture](docs/architecture.md).

## Installation

Installation instructions are being developed.

- [Linux installation](docs/installation/linux.md)
- [Docker Compose installation](docs/installation/docker.md)

**Do not deploy Tyravex in production until a stable release and security review are available.**

## Documentation

- [Configuration](docs/configuration.md)
- [Development](docs/development.md)
- [Architecture](docs/architecture.md)
- [Plugins](docs/plugins.md)

## Roadmap

- [ ] Establish the public development repository
- [ ] Stabilize authentication and frontend navigation
- [ ] Complete administrative settings
- [ ] Prepare Linux and Docker Compose deployment
- [ ] Implement the Node Agent
- [ ] Integrate Docker-based server provisioning
- [ ] Introduce server templates
- [ ] Develop the plugin SDK and extension system
- [ ] Prepare automated testing and releases

This roadmap is indicative and does not guarantee release dates.

## Contributing

Contributions, bug reports, documentation improvements, and feature suggestions are welcome.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## Security

Please do not disclose