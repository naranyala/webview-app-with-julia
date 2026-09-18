# System overview

WebViewApp is a local-first Linux desktop workspace. Its core intent is to turn
local notes, references, media, and analysis into durable, inspectable writing
artifacts without requiring a local web server or a cloud service.

## Runtime shape

```text
frontend/src/                 user interface and browser-safe adapters
        │
        ▼
frontend/dist/index.html      one generated, self-contained HTML artifact
        │
        ▼
bin/webview_app.jl            Julia host and request loop
        │
        ├── src/Backend.jl     RPC routing and application policy
        ├── src/PaperProjects.jl, Persistence.jl, Jobs.jl, Diagnostics.jl
        ├── src/WorkspacePolicy.jl, RendererCapability.jl
        └── ManualWebview + native/bridge.cc
```

The WebView callback never calls Julia directly. `native/bridge.cc` copies a
request into a bounded queue; Julia drains the queue, invokes a named handler,
and returns a response by request ID. Oversized or full queues fail explicitly.

## Boundaries

- `frontend/src/backend.js` is the only frontend-to-native adapter.
- `src/backend/router.jl` owns handler registration and error envelopes.
- `src/BindingManifest.jl` describes the shared binding-name contract.
- `src/WorkspacePolicy.jl` authorizes filesystem paths before access.
- `src/Persistence.jl` provides the stable application storage facade.
- `src/Build.jl` and `src/Deploy.jl` plan build/install work without owning
  subprocess execution or system-wide package management.

The `packages/` directory contains zero-dependency internal library candidates.
They are integrated through compatibility shims so consumers have one stable
application-facing API.

## Source of truth

When behavior and documentation disagree, inspect these in order:

1. `src/WebViewApp.jl` for module/include order.
2. `src/backend/router.jl` and `src/BindingManifest.jl` for RPC names.
3. `frontend/src/backend.js` for browser/native adapter behavior.
4. `Project.toml`, `frontend/package.json`, and `run.sh` for environment rules.
5. `TODOS.md` for known gaps and extraction status.
