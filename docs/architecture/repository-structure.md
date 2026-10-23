# Repository and file structure

**Status:** This document describes the *target organization based on existing directories*. Do not assume all example subfolders already exist. See [migration](migration.md).

```text
Tyravex/panel/
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
├── apps/
│   ├── frontend/
│   │   ├── README.md
│   │   └── src/
│   │       ├── app/                 # app wiring, router, guards
│   │       ├── pages/               # thin route compositions
│   │       ├── features/            # services, nodes, admin-users, auth...
│   │       │   └── services/
│   │       │       ├── api/
│   │       │       ├── components/
│   │       │       ├── hooks/
│   │       │       └── lib/
│   │       ├── entities/            # domain representations
│   │       ├── widgets/             # larger composed UI
│   │       ├── layouts/
│   │       └── shared/
│   │           ├── api/
│   │           ├── i18n/locales/{pl,en,de}/common.json
│   │           └── ui/
│   ├── backend/
│   │   ├── README.md
│   │   ├── prisma/                 # schema and migrations
│   │   └── src/
│   │       ├── modules/            # NestJS business modules
│   │       │   ├── services/
│   │       │   ├── server/         # legacy, preserve until migrated
│   │       │   ├── nodes/
│   │       │   │   ├── protocol/
│   │       │   │   └── transport/
│   │       │   ├── jobs/
│   │       │   ├── users/
│   │       │   └── ...
│   │       ├── infrastructure/     # existing Redis/queue integrations
│   │       ├── prisma/             # existing Prisma NestJS module
│   │       └── rbac/
├── packages/types/
└── docs/
    ├── README.md
    ├── architecture/
    │   ├── README.md
    │   ├── repository-structure.md
    │   ├── frontend.md
    │   ├── backend.md
    │   ├── agent.md
    │   ├── module-rules.md
    │   └── migration.md
    ├── development.md
    ├── configuration.md
    ├── plugins.md
    └── installation/{docker,linux}.md

Tyravex/agent/                      # separate GitHub repository
├── README.md
├── cmd/tyravex-agent/
├── internal/
│   ├── agent/
│   ├── api/
│   ├── config/
│   ├── docker/
│   ├── heartbeat/                 # legacy HTTP heartbeat client
│   ├── transport/                 # WebSocket transport
│   └── version/
├── scripts/
├── config.example.yml
└── go.mod
```

`internal/protocol`, `internal/executor` and `internal/services` are possible **future Go agent modules**, not current directories.

The old Panel `apps/agent` scaffold was removed in commit `c0c9eff`. Do not relocate the Go agent into `panel/apps`. Do not create empty folders for speculative features.
