# Egg catalog management

## Settings and update behavior

The Eggs tab in panel administration settings controls `officialEggAutoUpdate`, stored in `PanelSetting`. Missing settings default to false. Reading requires `settings:read`; changing the setting requires all of `settings:manage`, `egg-repository:sync`, and `egg:import`. Manual update checks require `egg:read` and `egg-repository:sync` and refresh version metadata without importing definitions.

The worker is part of the backend lifecycle, polls once per minute, and checks the catalog at most once per hour when enabled. It only accepts the enabled, non-archived official source at `https://raw.githubusercontent.com/Tyravex/tyravex-eggs/main/registry.json`. A conditional database lease prevents overlapping checks across backend instances. The lease expires after ten minutes and release is scoped to its exact timestamp.

Automatic checks reuse the pinned-commit repository adapter and reviewed-digest import path. The setting and source are rechecked before committing automatic imports, including a shared row lock on the setting. New valid versions become OFFICIAL-origin, PENDING, and disabled. Conflicting or invalid versions are not automatically imported. Existing versions, approvals, service selections, containers and files are never updated by this worker. Manual imports from files do not gain official provenance merely by choosing an official repository.

Latest-version metadata is cached on the repository, so table reads do not initiate network requests. Version comparison uses numeric semantic version components. The catalog shows current and available versions, source identity, category, colored tags, review/availability status and service usage. Details contain version history.

## Tags

System tags are inferred from the manifest's category, runtime and known Minecraft identity. They have stable IDs, translated labels and a fixed color palette; they cannot be edited or removed. No seed is required to create them.

Custom tags use one of seven allowed palette colors. Personal tags are scoped to the authenticated user; shared tags require `egg:manage`. Scope and ownership cannot be changed by renaming a tag. Names are limited to 40 characters and each scope is limited to 100 tags. Users can create, rename, recolor and delete their own tags. Administrators can manage shared tags but cannot read or alter another user's private tags.

Assignments are per Egg version, with at most 20 custom tags. An ordinary user may tag only their own CUSTOM Eggs; `egg:manage` permits administrative assignment. Assignment changes preserve private associations belonging to other users. Tag deletion removes assignments only, preserving Eggs and services. Personal management is available at `/settings/egg-tags`; administration has `/admin/eggs/tags` and assignment controls in Egg details.

## Archival and rollout

Archiving disables a non-official source and removes it from active lists. It never deletes its definitions or service references. Archived sources cannot be re-enabled through the status endpoint or synchronized. The official source cannot be archived. Existing service details retain access to their pinned definitions; the archived source cannot be selected for new installations.

The inspected `https://github.com/tyravex/eggs-test` source contained one Egg referenced by one service. `apps/backend/scripts/archive-test-egg-source.ts` targets exactly that source, defaults to preview and requires `--apply` for the approved archival operation. It must run only after the schema migration is applied.

Migration `20261115020000_egg_catalog_management` adds repository archival/check metadata and the custom tag/assignment tables. It does not seed tags, enable automatic updates, import Eggs, or archive sources by itself. It builds on the earlier service Egg configuration migration when that migration is not yet applied. Applying migrations and checking the database migration state require separate operator authorization; do not apply all pending migrations indiscriminately. Backend source changes do not require starting a separate scheduler service.
