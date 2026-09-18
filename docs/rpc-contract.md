# RPC contract

The RPC boundary connects `frontend/src/backend.js`, Julia handlers, and the
native request queue. Binding names are centralized in
`src/BindingManifest.jl`.

## Request flow

```text
window.<binding>(args)
  → frontend adapter timeout/error normalization
  → C++ bridge queue (bounded, request ID)
  → Julia handler lookup
  → policy + validation + operation
  → status + JSON response
```

The desktop launcher derives its registration list from
`BindingManifest.required_bindings(Backend.handler_names())`. Window actions are
included in the manifest even though they are handled by the host because they
need the WebView handle.

## Adding a binding

1. Add or update the Julia handler in `src/backend/` and register it in the
   router.
2. Add the name to the appropriate adapter in `frontend/src/backend.js`.
3. Add the name to `BindingManifest` if it is user-facing.
4. Define argument limits, path policy, result shape, and error codes.
5. Add a backend test for success and invalid/missing/oversized input.
6. Add a frontend adapter test for unavailable bindings, timeout, and error
   normalization.

`BindingManifest.validate()` reports frontend names missing from the backend and
backend names not represented by the frontend contract. The remaining contract
work is argument/result schema validation and CI enforcement.

## Error envelope

Successful handlers return status `0` and a JSON result. Failures return status
`1` and a JSON object containing at least `code` and `message`. The frontend
adapter turns that object into an `Error` while preserving `error.code`.

Use codes from `src/ErrorCodes.jl`; its registry also records category,
recoverability, and a user-facing description.
