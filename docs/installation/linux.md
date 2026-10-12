# Linux Installation

> **Not yet available for production deployment.**

Tyravex is currently in early development. A verified Linux installation procedure will be published after the application and deployment scripts are ready.

## Planned Requirements

- A supported Linux distribution
- Node.js and pnpm
- PostgreSQL
- A reverse proxy with HTTPS
- Docker on machines intended to host workloads
- A compatible Node Agent when available

## Planned Installation Process

The Linux installation guide will cover:

1. Installing system dependencies
2. Creating a dedicated service account
3. Configuring PostgreSQL
4. Installing Tyravex application dependencies
5. Setting environment variables and secrets
6. Running database migrations
7. Starting services with a service manager
8. Configuring HTTPS and the reverse proxy
9. Connecting Docker nodes
10. Performing upgrades and backups

## Security Considerations

Do not run the application with unnecessary root privileges.

Restrict database access, protect secrets, and use HTTPS for external communication.

Docker and node-management privileges require particular care.

## Current Status

Installation commands will be added only after they have been tested against an actual release.