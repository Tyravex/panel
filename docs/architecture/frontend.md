# Frontend module structure

Stack: React, TypeScript, Vite, Tailwind and react-i18next.

## Responsibilities

| Layer | Responsibility |
|---|---|
| `app/` | Application initialization, routing and access guards |
| `pages/` | Thin route components that compose features |
| `features/<domain>/api/` | Typed calls through `shared/api/client` |
| `features/<domain>/hooks/` | Fetching, state and business orchestration |
| `features/<domain>/components/` | Domain-specific UI |
| `features/<domain>/lib/` | Pure domain transformations and validation |
| `entities/` | Shared domain representations where needed |
| `widgets/` | Larger compositions across features |
| `layouts/` | Layouts and navigation shells |
| `shared/` | Generic UI, API client, i18n and utilities |

**Allowed dependency direction:** `app/pages -> widgets/features/entities/shared`; `widgets -> features/entities/shared`; `features -> entities/shared`; `entities -> shared`; `shared -> no higher layer`. Avoid feature-to-feature coupling and circular imports.

The existing services module is the model for future work: `features/services/{api,components,hooks,lib}` and a thin `pages/admin/AdminServicesPage.tsx`.

## Localization

Use the existing `shared/i18n/locales/pl/common.json`, `en/common.json`, `de/common.json` and `useTranslation()`. Add keys in all three languages; preserve existing keys and Polish plural forms. Do not introduce independent translation JSON files in feature folders.

## Migration cautions

- Two existing `ServerCard.tsx` files live in `widgets/server` and `widgets/server-card`; inspect references before consolidation.
- Keep `/servers/:id` route and its auth requirements working.
- Preserve `features/servers` compatibility while migrating to the `Service` abstraction.
- Move files with `git mv`, update import aliases and tests, run frontend build.
