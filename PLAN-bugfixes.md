# Plan: Bug Fixes and Code Quality Improvements

## Step 1: Add Tracked Section to TODOS.md

Add a new section "Bug Fixes and Code Quality" after the "Current Implementation Snapshot" section with all 21 issues tracked as TODO items.

## Step 2: Execute Phase 1 (Critical Bugs) — 9 items

### 2.1 Backend Critical Fixes

**Fix 1: `_is_within_workspace` undefined function**
- File: `src/backend/paper_projects.jl`
- The function is called at lines 212 and 244 but never defined
- Solution: Use `WorkspacePolicy.contains_path` from `Backend.jl` or define the function
- Verify: Run `julia --project=. -e 'using WebViewApp; println(WebViewApp.Backend._is_within_workspace("/tmp"))'`

**Fix 2: Route `parseBibTeX` to version with size validation**
- File: `src/backend/router.jl`
- Currently routes to `_parse_bibtex` in `analysis.jl` (no size check)
- Should route to `_parse_bibtex` in `bibtex_adapter.jl` (has `MAX_BIBTEX_BYTES` check)
- Solution: Update router mapping or rename the adapter function

**Fix 3: Unify filename regex**
- File: `src/backend/pdf.jl`
- `_save_pdf` line 11: `r"^[A-Za-z0-9][A-Za-z0-9._\-]{0,95}\.pdf$"i` (case-insensitive)
- `_generate_pdf` line 44: `r"^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.pdf$"` (case-sensitive)
- Solution: Use the same regex in both (case-insensitive, consistent `-` placement)

### 2.2 Frontend Critical Fixes

**Fix 13: `invalidResponse` returns Error, not rejected Promise**
- File: `frontend-preact/src/backend.js:272-276`
- `invalidResponse(name)` returns `error` (Error object)
- Should return `Promise.reject(error)` like `invalidArgument` and `unavailable`
- Solution: Change to `return Promise.reject(error)`

**Fix 14: `parseAudioAnalysisJob` discards valid jobs**
- File: `frontend-preact/src/schemas.js:160-163`
- When `value.rms !== undefined`, calls `parseAudioAnalysis(value)` which may return null
- If null, entire job returns null instead of job structure without analysis
- Solution: Check if analysis parsing fails, return job without analysis fields

**Fix 15: `parseAddBibtexToProjectResult` missing null check**
- File: `frontend-preact/src/schemas.js:516`
- Calls `parsePaperProject(value.project)` but doesn't check if result is null
- Solution: Add null check, return null if project parsing fails

### 2.3 Frontend Bug Fixes

**Fix 16: `unmountedRef` never reset in disk-scanner**
- File: `frontend-preact/src/plugins/disk-scanner.jsx:46,70`
- `unmountedRef.current` set to `true` in cleanup but never reset
- Breaks in React 18/Preact strict mode where effects may run twice
- Solution: Reset ref in effect initialization or use useState

**Fix 17: `selectNote` not awaited in chain-notes**
- File: `frontend-preact/src/plugins/chain-notes.jsx:188`
- `createNote` calls `selectNote(note)` without `await`
- If flush fails, error propagates as unhandled promise rejection
- Solution: Add `await` before `selectNote(note)`

## Step 3: Execute Phase 2 (Validation Hardening) — 5 items

**Fix 4: Add handle pruning to `PAPER_PROJECT_HANDLES`**
- File: `src/backend/paper_projects.jl:5`
- Dict grows forever, never pruned
- Solution: Add LRU eviction or TTL-based pruning

**Fix 5: Add type validation to `_mir_analyze`**
- File: `src/backend/analysis.jl:3-15`
- `samples` and `sample_rate` passed directly without type checking
- Solution: Add `AbstractVector` and `Number` checks

**Fix 6: Add size limit to `_generate_pdf` body**
- File: `src/backend/pdf.jl:30-54`
- No length check on `body` argument
- Solution: Add `MAX_NOTE_BODY` constant and check

**Fix 7: Add size limit to `_export_bibliography` entries**
- File: `src/backend/bibtex_adapter.jl:46-74`
- No limit on `entries_data` array size
- Solution: Add `MAX_BIBLIOGRAPHY_ENTRIES` constant

**Fix 8: Add null check to `_add_bibtex_to_project`**
- File: `src/backend/bibtex_adapter.jl:97`
- Assumes `project["references"]` is array
- Solution: Add `AbstractVector` check

## Verification

1. Run Julia tests: `julia --project=. -e 'using Pkg; Pkg.test()'`
2. Run frontend tests: `npm test` in `frontend-preact/`
3. Run binding check: `npm run check:bindings`
4. Run production build: `npm run build`

## Summary

- **Phase 1 (9 items)**: Critical bugs that cause crashes or incorrect behavior
- **Phase 2 (5 items)**: Validation hardening to prevent edge cases
- **Total**: 14 items to fix, 7 remaining for future work
