# Tyravex Architecture

## Overview

Tyravex is a modular server management platform designed around a web application, backend API, database, and a dedicated Node Agent.

Some architectural components are planned and are not yet fully implemented.

## Main Components

### Frontend

The frontend uses React, TypeScript, and Vite.

Responsibilities include:

- Authentication interface
- Server and user dashboards
- Administrative views
- Notifications
- Localization and theme preferences

### Backend

The backend uses NestJS and TypeScript.

Responsibilities include:

- Authentication and authorization
- User management
- Server metadata and business logic
- Administrative APIs
- Database access
- Communication with node services (planned)

### Database

PostgreSQL is the primary database, accessed through Prisma.

The database stores application state, including users, servers, and related metadata.

### Node Agent (Planned)

The Node Agent will run on machines hosting Docker workloads.

Its planned responsibilities include:

- Managing container lifecycle operations
- Reporting server status and resource usage
- Handling server files and console interactions
- Communicating securely with the central panel

The exact communication protocol and security model are still being designed.

### Plugin System (Planned)

Tyravex aims to support built-in and third-party extensions.

The plugin system will require defined APIs, permission boundaries, version compatibility, and installation procedures.

## Conceptual Architecture

```text
User / Administrator
        |
        v
React Frontend
        |
        v
NestJS Backend ------ PostgreSQL
        |
        | Secure node communication (planned)
        v
    Node Agent
        |
        v
      Docker
        |
        v
Game Servers / Bots / Applications
```

## Repository Layout

The intended monorepo structure includes:

- `apps/frontend` — Web application
- `apps/backend` — API and business logic
- `packages/types` — Shared TypeScript types
- `docs` — Project documentation
- `.github` — GitHub community and automation configuration

## Design Principles

- Clear separation of concerns
- Secure defaults
- Modular components
- Backward-compatible evolution where practical
- Explicit authorization boundaries
- Extensible interfaces
- Transparent open-source development

## Current Status

This document describes the intended architecture and will be updated as the implementation evolves.