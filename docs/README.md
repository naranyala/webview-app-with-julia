# Documentation

This documentation covers the Julia desktop launcher, Preact frontend, and
native WebView bridge.

## Contents

- [Getting started](getting-started.md): prerequisites, installation, build, and launch commands.
- [Architecture](architecture.md): runtime flow and repository boundaries.
- [Frontend guide](frontend.md): the shell, plugin registry, build pipeline, and extension points.
- [Backend and bridge](backend.md): Julia/C ABI bindings, request queues, frontend contracts, and mocks.
- [Tools](tools.md): the registered tools and their native/browser behavior.
- [Testing and maintenance](testing.md): test commands, generated data refresh, and benchmarks.

## Repository overview

The launcher registers ten plugins through `frontendPlugins`. Their behavior is
documented in [Tools](tools.md).

The Julia launcher registers the frontend backend contract through the queue
bridge. The frontend adapter uses mocks when bindings are unavailable, and
`check:bindings` validates the registered names.
