# Tyravex architecture

Tyravex is a **modular monolith** in the Panel repository plus a **separate Go Node Agent**.

```text
Browser -> React/Vite -> NestJS API -> PostgreSQL/Prisma
                              |
                         Redis/BullMQ Jobs
                              |
                    authenticated WebSocket
                              |
                      Go Node Agent -> Docker
```

**Implemented foundations:** node authentication, WebSocket hello/welcome, heartbeat/ack, service draft creation, ownership, RBAC, background jobs infrastructure.

**Not yet implemented end-to-end:** service installation and Agent command execution. Protocol command types exist but do not imply working provisioning.

## Architecture documents

- [Repository structure](repository-structure.md)
- [Frontend](frontend.md)
- [Backend](backend.md)
- [Go Agent](agent.md)
- [Module rules — mandatory](module-rules.md)
- [Migration plan](migration.md)

## Design principles

1. One clear owner per domain; avoid duplicate APIs, services and queues.
2. Preserve behavior and security boundaries during refactors.
3. Treat `Service` as the target hosting abstraction; migrate legacy `Server` carefully.
4. Backend authorizes and schedules; Agent executes allowlisted infrastructure commands.
5. Keep agent and panel as separate release/deployment units.
6. Prefer small, tested migrations over sweeping directory reorganizations.
