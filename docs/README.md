# Documentation

This directory describes the repository as it exists today: a Julia desktop
launcher, a Preact frontend, and a small native WebView bridge.

## Start here

- [Getting started](getting-started.md) — prerequisites, install, build, and launch commands.
- [Architecture](architecture.md) — runtime flow and repository boundaries.
- [Frontend guide](frontend.md) — the shell, plugin registry, build pipeline, and extension points.
- [Backend and bridge](backend.md) — Julia/C ABI bindings, request queues, frontend contracts, and mocks.
- [Tools](tools.md) — the registered tools and their native/browser behavior.
- [Testing and maintenance](testing.md) — test commands, map data refresh, benchmarks, and known verification gaps.

## Current-state summary

The active shell registers ten frontend plugins:

1. Sample Library
2. Monitor EQ
3. Tab Vault
4. MIR Papers
5. MIR Lab
6. Indonesia Map
7. Chain Notes
8. Quiz
9. Blender Companion
10. Todos

The native Julia launcher registers the frontend backend contract through the
queue bridge. The frontend adapter falls back to browser-safe mocks when the
bindings are unavailable, and `check:bindings` validates the launcher list.
