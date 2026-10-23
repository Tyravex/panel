# Linux Installation

> **Not yet available for production deployment.**

Tyravex is currently in early development. A verified Linux installation procedure will be published after the application and deployment scripts are ready. For local development, use the [Development Guide](../development.md).

## Planned Requirements

- A supported Linux distribution
- Node.js and pnpm for the Panel
- PostgreSQL and Redis for the applicable Panel components
- A reverse proxy with HTTPS
- Docker on machines intended to host workloads
- The separate [Tyravex Go Node Agent](https://github.com/Tyravex/agent) on hosting nodes

The Go Agent already exists and provides local diagnostics and an authenticated WebSocket heartbeat. **End-to-end service provisioning and production node integration are not yet complete.** Its availability does not make the Panel production-ready.

## Planned Installation Process

The Linux installation guide will cover:

1. Installing system dependencies
2. Creating a dedicated service account
3. Configuring PostgreSQL and required Redis services
4. Installing Tyravex Panel application dependencies
5. Setting environment variables and secrets
6. Running database migrations
7. Starting services with a service manager
8. Configuring HTTPS and the reverse proxy
9. Installing and connecting the separate Go Agent on Docker nodes
10. Performing upgrades and backups

## Security Considerations

Do not run the application with unnecessary root privileges. Restrict database access, protect secrets, and use HTTPS for external communication. Docker and node-management privileges require particular care. Never expose the Agent's loopback HTTP diagnostics API or the Docker socket publicly.

## Current Status

Production installation commands will be added only after they have been tested against an actual release. Do not use this planned outline as a production deployment procedure.
