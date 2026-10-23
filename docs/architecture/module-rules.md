# Mandatory module rules

These rules apply to every new feature and every migration.

1. **One domain, one owner.** Put domain logic in its feature/module. Do not duplicate APIs, queues, Docker adapters, authorization or i18n.
2. **Thin frontend pages.** Route components compose; business fetching and state live in feature hooks/API; generic controls live in `shared/ui`.
3. **Respect dependency direction.** Never import `pages`/`app` from a feature or feature code from `shared`. Avoid cross-feature imports and circular dependencies.
4. **Backend boundaries.** Controllers validate and authorize; application/domain services manage transitions; Jobs run durable tasks; Agent executes runtime operations.
5. **Separate repositories.** Panel is React/NestJS; Agent is Go in `Tyravex/agent`. Do not reintroduce a TypeScript Agent inside the Panel.
6. **Centralized translations.** Keep `shared/i18n/locales/{pl,en,de}/common.json`, with matching new keys and no deleted legacy keys.
7. **Preserve compatibility.** Do not break existing URLs, permission checks, DTOs, database migrations, Server/Service relationships or agent protocol.
8. **Security first.** No arbitrary shell execution; no publicly exposed local Agent API; validate and audit commands.
9. **Migrate incrementally.** Inspect imports; use `git mv`; update references and tests; verify each module before moving the next.
10. **No speculative scaffolding.** Only create modules for implemented or immediately planned work.
11. **Tests before commits.** Run relevant builds/tests and `git diff --check`; report actual results, never assumptions.
12. **Clean commits.** Do not stage `.vscode/`, secrets, local `.env`, backups or unrelated files. Comments in code should be English.

See [Migration](migration.md) for the executable checklist.
