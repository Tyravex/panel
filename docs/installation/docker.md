# Docker Compose Installation

> **Not yet available for production deployment.**

Tyravex plans to support Docker Compose as a deployment option for the central Panel. A complete, verified deployment configuration has not yet been published.

The existing repository `docker-compose.yml` starts **development PostgreSQL and Redis infrastructure only**, not a production Panel stack. See [Development](../development.md) and [Configuration](../configuration.md).

## Planned Services

The deployment may include:

- Tyravex frontend
- Tyravex backend
- PostgreSQL
- Redis for background jobs
- Reverse proxy, depending on deployment configuration

The [Go Node Agent](https://github.com/Tyravex/agent) is maintained and deployed separately on machines hosting workloads. It already supports authenticated WebSocket heartbeat and Docker diagnostics; complete provisioning and command execution are still under development.

## Planned Installation Process

1. Install Docker Engine and Docker Compose.
2. Download a supported Tyravex release.
3. Create the required environment configuration.
4. Configure persistent database storage.
5. Start the Compose services.
6. Apply database migrations.
7. Configure HTTPS.
8. Complete initial administrator setup when supported.
9. Install the separate Go Agent and connect hosting nodes when end-to-end integration is ready.

These are planned steps, not verified commands.

## Persistent Storage

Database data must be stored in persistent volumes or another supported persistent storage solution. Backup and restore procedures must be verified before production deployment.

## Security

- Never publish database ports unnecessarily.
- Use strong, unique secrets.
- Protect environment files.
- Avoid exposing the Docker socket to the Panel.
- Keep images and dependencies updated.
- Use HTTPS for external access.
- Do not expose the Agent's local diagnostics API publicly.

## Current Status

A complete Compose file and verified commands will be added when the deployment implementation is ready.
