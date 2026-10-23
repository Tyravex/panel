# Tyravex Plugin System

Tyravex aims to support built-in and third-party extensions. **The plugin SDK and extension APIs are planned and not yet stable.**

## Goals

- Additional administrative functionality
- Custom integrations
- Server management extensions
- Dashboard capabilities
- Server templates and related tooling

## Design principles

**Security:** Plugins must operate within explicit permission boundaries; trusted backend components authorize sensitive operations.

**Compatibility:** Plugins should declare supported Tyravex versions.

**Modularity:** Extensions should use documented interfaces and follow the [module rules](architecture/module-rules.md) rather than depend on internal implementation details.

**Transparency:** Plugin metadata should identify author, version, dependencies and required permissions.

## Planned plugin metadata

A future manifest may describe identifier, name, description, version, author, license, compatibility, permissions, dependencies and entry points. The final format is not defined.

## Lifecycle and SDK

Installation, update, enable/disable, removal and developer SDK interfaces will be specified when the plugin manager is implemented. Third-party distribution and compatibility policies remain under development.

## Status

The plugin system is in the design stage. Proposals are welcome through GitHub Issues.
