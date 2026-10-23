# Incremental modular migration

This document is a **plan**. A checked item requires a verified commit; do not mark it complete based on intent alone.

## Phase A — architecture documentation

- [ ] Update root `README.md` and documentation index.
- [ ] Move `docs/architecture.md` to `docs/architecture/README.md` and revise content.
- [ ] Add the remaining files in `docs/architecture/` and `docs/README.md`.
- [ ] Replace Vite/NestJS template READMEs with Tyravex-specific guides.
- [ ] Update `CONTRIBUTING.md`, `docs/development.md`, `docs/plugins.md` and stale architecture links.
- [ ] Check internal Markdown links and commit docs only.

## Phase B — frontend

- [ ] Inspect consumers of both `widgets/server/ServerCard.tsx` and `widgets/server-card/ServerCard.tsx`.
- [ ] Consolidate only after comparing behavior and verifying imports.
- [ ] Audit `ServerDetailsPage.tsx`, `features/servers` and compatibility with `features/services`.
- [ ] Keep route URLs, permissions and PL/EN/DE translations working.
- [ ] Run frontend build and smoke tests for each moved module.

## Phase C — backend

- [ ] Audit dependencies among `modules/server`, `modules/services`, `modules/nodes` and `modules/jobs`.
- [ ] Define migration policy from legacy Server to Service.
- [ ] Reuse existing Jobs/Prisma/RBAC/Nodes infrastructure.
- [ ] Run backend Jest tests and build after each focused change.

## Phase D — agent ownership

- [x] Audit and remove the legacy Panel `apps/agent` scaffold (`c0c9eff`; frontend/backend builds and 753 backend tests passed).
- [ ] Update the separate Go Agent README to link to Panel architecture.
- [ ] Extend WebSocket command protocol and executor in separately tested stages.

## PowerShell verification

```powershell
cd D:\GitHub\Tyravex\panel
git status --short
git grep -n "docs/architecture.md"
git grep -n "widgets/server-card\|widgets/server/ServerCard"
pnpm run build
git diff --check
git diff --cached --check
```

Use `git mv` for file moves and `git add` with explicit paths; never stage `.vscode/` or local secrets.

## Migration history

| Commit | Scope | Verification |
|---|---|---|
| `721a244` | Modular admin services UI and PL/EN/DE translations | Build reported by user |
| `c0c9eff` | Removed legacy TypeScript Agent and updated pnpm lockfile | 77 test suites, 753 passed, frontend/backend builds passed |
| Pending | Architecture documentation | Not yet committed |
