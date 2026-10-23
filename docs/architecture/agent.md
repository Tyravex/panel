# Tyravex Go Agent

The canonical Agent is a **separate repository**: [Tyravex/agent](https://github.com/Tyravex/agent). The previous `panel/apps/agent` TypeScript scaffold was removed in commit `c0c9eff`.

## Current modules

- `cmd/tyravex-agent`: CLI entry point.
- `internal/agent`: runner, connection lifecycle.
- `internal/transport`: WebSocket client and heartbeat.
- `internal/api`: loopback-only local HTTP diagnostics API.
- `internal/config`: YAML configuration and validation.
- `internal/docker`: Docker Engine diagnostics.
- `internal/heartbeat`: older HTTP heartbeat client; audit consumers before removal.
- `internal/version`: version/build information.

## Boundaries and future growth

`transport` owns network messages; future `protocol` validates wire types; future `executor` dispatches allowlisted commands and records results; future `services` manages installations; `docker` owns Docker API calls. Add these only when implementation starts, not as empty placeholders.

Agent initiates the WebSocket connection to the Panel at `/agent/v1/ws`. Do not expose the local HTTP API publicly. Do not accept arbitrary shell commands or unvalidated Docker arguments. Authenticate the node, enforce operation allowlists and support idempotent retries.

## Repository docs

The Agent has its own [README](https://github.com/Tyravex/agent/blob/main/README.md). The Agent README may link to the Panel architecture after the documentation is published. Some existing Agent README wording about remote transport is outdated and should be reviewed against the implemented WebSocket heartbeat.

## Verification

Use `go fmt ./...`, `go vet ./...`, `go test ./...` and the existing build workflow before Agent commits.
