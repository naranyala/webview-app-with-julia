# Documentation

This directory describes the repository as it exists today: a Julia desktop
launcher, a Preact frontend, and a small native WebView bridge.

## Start here

- [Getting started](getting-started.md) — prerequisites, install, build, and launch commands.
- [Architecture](architecture.md) — runtime flow and repository boundaries.
- [Frontend guide](frontend.md) — the shell, plugin registry, build pipeline, and extension points.
- [Backend and bridge](backend.md) — Julia/C ABI bindings, request queues, frontend contracts, and mocks.
- [Tools](tools.md) — the six registered tools and the source-only modules that are not yet wired into the shell.
- [Testing and maintenance](testing.md) — test commands, map data refresh, benchmarks, and known verification gaps.

## Current-state summary

The active shell registers six frontend plugins:

1. Sample Library
2. Monitor EQ
3. Tab Vault
4. MIR Papers
5. MIR Lab
6. Indonesia Map

The repository also contains Chain Notes, Quiz, Todos, and Blender Companion
components. They are implemented in `frontend-preact/src/plugins/`, but they
are not currently included in `frontendPlugins` and therefore do not appear in
the launcher.

The native Julia launcher currently binds `calculateFibonacci`, `closeWindow`,
and `closeApp`. The frontend adapter models a broader backend contract and
falls back to browser-safe mocks when bindings are unavailable. The referenced
Zig backend tree is not present in this checkout, so the binding drift check is
currently unable to run.
