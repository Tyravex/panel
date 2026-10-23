# Tyravex Frontend

React + TypeScript + Vite frontend for the Tyravex hosting panel.

## Structure

- `src/app` — application routing, guards and setup.
- `src/pages` — thin route compositions.
- `src/features/<domain>` — API, hooks, business UI and pure domain logic.
- `src/widgets` — larger UI compositions.
- `src/entities` — shared domain representations.
- `src/layouts` — page layouts.
- `src/shared` — API client, generic UI and centralized i18n.

Read [Frontend architecture](../../docs/architecture/frontend.md) and [module rules](../../docs/architecture/module-rules.md) before editing.

## Development

From the repository root:

```powershell
pnpm install
pnpm dev:frontend
```

Build:

```powershell
pnpm --filter ./apps/frontend build
```

Translations are maintained in `src/shared/i18n/locales/{pl,en,de}/common.json`. Do not add separate feature translation files.

See [Development](../../docs/development.md) for environment configuration and backend setup.
