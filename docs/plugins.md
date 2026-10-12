# Tyravex Plugin System

## Overview

Tyravex aims to provide an extensible plugin system that supports both built-in and third-party extensions.

> The plugin SDK and extension APIs are planned features and are not yet stable.

## Goals

The plugin architecture is intended to support:

- Additional administrative functionality
- Custom integrations
- Server management extensions
- New dashboard capabilities
- Server templates and related tooling

## Design Principles

### Security

Plugins should operate with clearly defined permissions.

Sensitive operations must be validated and authorized by trusted backend components.

### Compatibility

Plugins should declare which Tyravex versions they support.

Breaking changes should be documented and versioned.

### Modularity

Extensions should use documented interfaces instead of relying on internal implementation details.

### Transparency

Plugin metadata should identify the author, version, dependencies, and required permissions.

## Planned Plugin Metadata

A future plugin manifest may describe:

- Plugin identifier
- Name and description
- Version
- Author
- License
- Compatible Tyravex versions
- Required permissions
- Dependencies
- Entry points

The final manifest format has not been defined.

## Plugin Installation

The installation, update, enable/disable, and removal lifecycle will be specified when the plugin manager is implemented.

## Third-Party Plugins

Third-party plugins may be maintained independently of the core project.

Compatibility, security review, distribution policies, and licensing boundaries will be documented before the plugin SDK is released.

## Developer SDK

A dedicated SDK is planned to help developers create extensions without depending on undocumented internal APIs.

## Current Status

The plugin system remains in the design stage. Contributions and proposals are welcome through GitHub Issues.