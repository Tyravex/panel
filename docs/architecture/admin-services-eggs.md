# Admin Services and Eggs

## Module boundaries

Frontend route composition lives in `src/app/router/routes`, with admin route groups per domain. Guards live in `router/guards`; legacy import paths re-export them. App providers and startup logic live in `app/providers` and `app/bootstrap`. Session bootstrap belongs to `features/auth`.

Service pages live in `pages/admin/services`, reusable forms and API calls in `features/services`. Creation, details, configuration, ownership, and installation have separate routes. Configuration edits are limited to drafts and use optimistic concurrency. An Egg selection pins a specific version; changing the library does not replace existing service configuration.

Egg pages live in `pages/admin/eggs`, with API, forms, repository preview, and validation in `features/eggs`. Editing creates a new pending, disabled version. Existing versions remain intact. Approval and enabling are separate actions.

## Repository format

Use a direct public HTTPS URL to a JSON index, for example a raw repository file URL. An HTML repository page is not an index. The native format is:

```json
{
  "format": "tyravex-egg-repository",
  "schemaVersion": 1,
  "eggs": ["eggs/example.json"]
}
```

The importer also supports `Tyravex/tyravex-eggs` repository schema v1: `schemaVersion: 1` with object entries containing `id`, `name`, `category`, `version`, and `path`. GitHub repository URLs normalize to a raw `main/registry.json` URL. A direct raw URL can select another ref. Each preview resolves GitHub refs to a commit SHA and loads every manifest from that same commit.

Paths resolve relative to the index and must remain on the same origin and, for GitHub, inside the pinned repository/commit. The index can contain up to 50 unique entries. Preview validates manifests without writing to the database; invalid entries are displayed separately. Synchronization requires the reviewed preview digest, rejecting upstream or source changes between preview and import. It imports only selected new entries; conflicting versions are rejected and identical versions are skipped. Imported versions are COMMUNITY, PENDING, and disabled. Approval and enabling must follow separately.

Imported provenance records the pinned source URL, path, commit, import timestamp, and SHA-256 of canonical JSON (sorted object keys, array order preserved). This is a semantic JSON hash, not a hash of the original response bytes. Existing version contents and service assignments are never overwritten.

Each remote document is limited to 1 MiB with an 8-second request timeout. The loader accepts public HTTPS destinations, validates DNS addresses, pins the resolved address, and rejects redirects and compressed responses. Preview and import do not execute manifest commands.

## Native Egg example

```json
{
  "format": "tyravex-egg",
  "formatVersion": 1,
  "id": "example-game",
  "name": "Example game",
  "version": "1.0.0",
  "category": "server",
  "runtime": { "image": "example/game:1.0.0", "startup": "./start" },
  "resources": { "memoryMb": 1024, "cpuPercent": 100, "diskMb": 2048 },
  "variables": [{ "name": "GAME_TOKEN", "required": true, "secret": true }]
}
```

Categories are `server`, `discord_bot`, `telegram_bot`, and `other`. Repository categories map explicitly: games to server, applications to other, and recognized Discord/Telegram bot identifiers to their respective categories. Unmapped bot types are rejected. Repository v1 has no resource defaults, so the panel supplies editable suggestions (512 MiB memory, 100% CPU, 1024 MiB disk).

The adapter preserves dependency installer, working directory, runtime versions, startup modes, profiles and default selections in validated `manifest.catalog` metadata. Unknown fields, unsafe entrypoints, duplicate profiles, unknown runtime versions and installer/startup mismatches are rejected. A service pins the resolved profile, runtime version and image in its own configuration. The non-secret descriptor matches the Agent's `ServiceInstallCatalog` validator. The protocol supports at most 64 variable declarations and CPU from 1 to 100 percent. This importer does not convert Pterodactyl Eggs or claim support for repository schemas newer than v1.

## Environment values and Agent delivery

Environment edits have a separate page at `/admin/services/:id/environment`. `service:read:any` can inspect configured/missing names; `service:manage:any` can change values on draft or failed services. Values are never returned to administrative GET requests. Untouched fields preserve existing values; explicit null removes a value. Only declared variable names are accepted. Configuration and environment writes are blocked while an installation is active.

The `ServiceEggConfiguration` relation stores profile/runtime selections and AES-256-GCM encrypted environment data. Ciphertext is authenticated to the service ID and uses a fresh IV for every write. `SERVICE_ENVIRONMENT_KEY` must be a dedicated 32-byte hexadecimal key, preserved and backed up separately from the database. `node scripts/configure-service-environment-key.cjs` only adds a key when absent and never prints it. Changing an Egg clears stored configuration and environment values; the form explains this before saving.

The Agent delivery endpoint is `POST /agent/nodes/:nodeId/environment`, with Agent Bearer authentication and `commandId`/`sessionId` in the request body. It requires HTTPS, an active matching WebSocket session, a SENT/ACCEPTED installation command and a QUEUED/RUNNING job for that node/service. It rejects configuration newer than the job snapshot. Only variables declared by the job snapshot are delivered. The response is AES-256-GCM sealed to the Agent token, session, node, service, job and command, expires after 30 seconds, and carries `Cache-Control: no-store`. Neither plaintext values nor authentication tokens enter job/command/audit metadata. The Agent client requires HTTPS, refuses redirects, checks expiry and bindings, and validates declared variable names after decryption. Public test fixtures verify TypeScript–Go interoperability.

Behind TLS termination, configure only the actual reverse proxy IP addresses in `TRUSTED_PROXY_IPS`. The default trusts no forwarding headers; plain HTTP delivery is refused. Never configure blanket proxy trust to make HTTPS detection pass.

## Installation availability

The readiness endpoint reports required and currently advertised Agent capabilities. HELLO capabilities are bound to the current live session, never inferred from Docker availability or a role name. The local Agent advertises validation/planning only and still rejects execution of `service.install`. The panel's dispatcher currently selects legacy Server jobs only. Both limitations are explicit blockers; imported Eggs and configuration can be managed independently. Secure delivery helpers do not enable installation execution by themselves. Port allocation, enforceable disk quotas, dependency installation and service-job dispatch/execution must be completed before advertising execution capability. No default ports or unenforced resource limits are fabricated.

Approved newer versions are shown as update candidates, comparing semantic version components numerically. They never automatically replace the pinned service version. Editing a running service remains blocked; migration of a running service requires a separate future update workflow and its authorization.

## Authorization and rollout

Service operations use `service:read:any`, `service:create`, `service:manage:any`, `service:transfer:any`, and `service:install:any`. Ownership selection also requires `user:read`. Egg operations use `egg:read`, `egg:import`, `egg:manage`, `egg:approve`, `egg-repository:manage`, and `egg-repository:sync`. Repository synchronization requires both sync and import rights. A role name alone grants nothing.

The permission catalog and default-role templates contain the rights. Existing editable role assignments are preserved; no role name bypasses permission checks. The operator-approved scoped permission repair adds only Eggs permissions and Owner links. The source configuration script adds or updates the selected official source without importing or approving Eggs. A newly added source is disabled until an administrator enables it.

Migration `20261115010000_service_egg_configuration` adds nullable Egg provenance and the new service configuration table. It is additive and does not rewrite existing records. Applying it requires separate operator approval; generating Prisma Client or running source validation does not apply it. Back up the database before rollout according to the deployment procedure, keep the encryption key, and restart the backend through the operator's normal process to load configuration. Do not run the full seed as a substitute for this migration.
