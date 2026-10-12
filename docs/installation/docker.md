# Docker Compose Installation

> **Not yet available for production deployment.**

Tyravex plans to support Docker Compose as a deployment option for the central panel.

A complete, verified deployment configuration has not yet been published.

## Planned Services

The deployment may include:

- Tyravex frontend
- Tyravex backend
- PostgreSQL
- Reverse proxy, depending on deployment configuration

The Node Agent is intended to operate separately on machines hosting workloads.

## Planned Installation Process

1. Install Docker Engine and Docker Compose.
2. Download a supported Tyravex release.
3. Create the required environment configuration.
4. Configure persistent database storage.
5. Start the Compose services.
6. Apply database migrations.
7. Configure HTTPS.
8. Complete initial administrator setup.
9. Register nodes when Node Agent support becomes available.

## Persistent Storage

Database data must be stored in persistent volumes or another supported persistent storage solution.

## Security

- Never publish database ports unnecessarily.
- Use strong, unique secrets.
- Protect environment files.
- Avoid exposing the Docker socket to the panel.
- Keep images and dependencies updated.
- Use HTTPS for external access.

## Current Status

A complete Compose file and verified commands will be added when the deployment implementation is ready.