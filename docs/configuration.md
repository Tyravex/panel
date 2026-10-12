# Configuration

Tyravex is configured using environment variables and, in future releases, administrative settings.

> This document is preliminary. Variable names and behavior must be verified against the application source before deployment.

## Environment Variables

An example configuration is available in the repository root:

`.env.example`

Potential configuration categories include:

- Application environment and port
- PostgreSQL connection
- Authentication secrets
- Frontend API URL
- CORS configuration
- Node Agent connectivity

## Secrets

Never commit a populated `.env` file.

Use long, randomly generated secrets for authentication and service-to-service communication.

Do not reuse the same secret for different purposes.

## Database

Tyravex uses PostgreSQL with Prisma.

Database migrations must be applied using the commands defined by the published backend project.

## Reverse Proxy

Production deployments should use HTTPS and a correctly configured reverse proxy.

Detailed reverse proxy instructions will be provided when the deployment configuration is finalized.

## Node Configuration

Remote node registration and agent authentication are planned features.

Do not expose the Docker socket or unauthenticated node management endpoints to the public internet.

## Updating Configuration

After changing environment variables, the affected services may require a restart.

Specific restart commands will be documented alongside the supported installation methods.