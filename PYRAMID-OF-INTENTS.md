# Pyramid of Intents

## Single core intent

**Help a person turn locally held working material into trustworthy, reusable
knowledge outputs—especially written research papers and PDFs—without giving up
control of their files.**

WebViewApp is therefore a local-first desktop workbench, not a collection of
unrelated utilities. Writing and paper production are the primary outcome.
Research search, local-media discovery, inspection, and music-information
retrieval (MIR) are supporting ways to find, understand, and select material
that may inform that outcome. They are also useful in their own right, but do
not redefine the product around browsing, audio playback, or general file
management.

The pyramid reads bottom-up: a higher layer is credible only when its
dependencies below it are true.

```text
                                      /\\
                                     /  \\
                                    / L1 \\
                                   /      \\
                                  /--------\\
                                 /   L2     \\
                                /------------\\
                               /     L3       \\
                              /----------------\\
                             /       L4         \\
                            /--------------------\\
                           /         L5           \\
                          /------------------------\\
```

## L1 — Outcome: useful, shareable knowledge output

The product succeeds when a user can confidently take a note, research idea,
or structured paper project through to a durable, readable output. Today the
clearest concrete output is a native single- or two-column PDF; the enduring
project data and its reproducibility record are equally important outputs.

This is deliberately more specific than “be a productive workspace” and more
honest than “perfect PDF round-trip.” The active product can create, save,
open, validate, enrich, and export paper projects. It does **not** currently
import or edit arbitrary existing PDFs, nor does its current PDF renderer
preserve every project field (for example figures and tables) as a rich
typeset layout.

## L2 — User capabilities: compose, substantiate, and deliver

These are the jobs a user must be able to complete to reach L1.

| Capability | User intent | Current product expression |
| --- | --- | --- |
| Capture and develop | Record ideas before they are lost; turn them into prose. | Persistent notes with title, tag, body, and PDF export. |
| Compose a structured paper | Shape a document rather than merely hold a text blob. | Paper projects with metadata, sections, table of contents, references, figures, tables, templates, and export profiles. |
| Substantiate claims | Bring sources into the work and retain their identity. | BibTeX parsing and merge into a paper project. |
| Find supporting material | Locate external context and local assets without leaving the workflow blind. | Direct-search launchers, directory browsing, media inspection, asset scans, and image gallery. |
| Understand audio material | Make evidence-based decisions about WAV files. | Metadata plus cancellable quick or spectral MIR analysis. |
| Deliver and revisit | Produce a PDF and later reopen the source of truth. | Native PDF generation, project open/save/validation, project handles, and reproducibility manifest. |

**Dependency rule:** a tool belongs only if it strengthens one of these
capabilities or preserves the user’s control over them. A tool is not justified
merely because it can be placed in a workspace.

## L3 — Domain model and workflows: make material meaningful

L2 needs stable representations and explicit flows, not just UI forms.

| Intent | System responsibility |
| --- | --- |
| Preserve authorship and structure | Treat a paper as a versioned `paper.json` manifest with identity, authors, sections, table of contents, bibliography, figures, tables, supplementary material, template, export profiles, extension state, and provenance. Normalize and validate it before persistence or export. |
| Keep notes lightweight and durable | Maintain a bounded note collection with clear CRUD semantics, an in-memory session state, and coalesced durable persistence. |
| Make research inputs usable | Parse BibTeX into structured references; model media and audio inspection results as explicit data rather than UI-only impressions. |
| Make long work interruptible | Run scans, conversions, and audio analysis as bounded jobs with visible states and cancellation. |
| Make delivery repeatable | Render a paper’s textual structure through the native PDF generator and record project/toolchain/profile hashes in `.app/reproducibility.json`. |
| Separate discovery from ownership | Search providers open external searches; local browsing and inspection discover material but do not silently absorb it into a paper. |

**Key boundary:** `paper.json` is the durable editorial source of truth; an
exported PDF is a delivery artifact. The PDF must never become the only copy of
the user’s editable work.

## L4 — Trustworthy application behavior: preserve control and explain failure

The workflows above only matter if users can trust them with local work.

| Intent | System responsibility |
| --- | --- |
| Keep files within the user’s authority | Canonicalize paths, resolve symlinks, and authorize reads/writes/projects only under `~/Documents` and configured workspace roots (or discovered volume roots for applicable reads). |
| Prevent partial or unbounded state | Use schema-versioned JSON envelopes, size limits, same-directory temporary writes followed by rename, and typed storage errors. |
| Keep the desktop boundary explicit | Route all frontend-to-Julia work through named, bounded RPC bindings with JSON arguments/results, payload limits, request IDs, timeouts, and structured errors. Browser development must fail explicitly when a native capability is unavailable. |
| Keep the UI responsive | Move expensive scan and audio work to cancellable background jobs; poll a stable job status rather than blocking interaction. |
| Make operations diagnosable | Capture bounded, structured JSONL diagnostics with request operation, duration, error category, and recoverability; diagnostics must not make the original operation fail. |
| Preserve runtime intent at shutdown | Flush scheduled note writes before the desktop host exits. |

**Dependency rule:** no higher-level convenience feature may bypass workspace
authorization, bounded input/output, atomic persistence, or structured error
handling. Those constraints are product behavior, not implementation detail.

## L5 — Enabling platform: a maintainable local desktop system

The foundation exists to make L4 dependable.

| Intent | Implementation boundary |
| --- | --- |
| Present a focused desktop workspace | An Octane frontend defines reachable Writing, Analyze music, Research, and Media tools, then Rsbuild emits one self-contained HTML document for the WebView. |
| Execute local capabilities | Julia owns application services: persistence, policy, paper projects, PDFs, BibTeX, filesystem/media adapters, diagnostics, and jobs. |
| Cross the UI/runtime boundary safely | WebView callbacks enter a C++ mutex-protected bounded queue; Julia drains requests and returns results by request ID instead of calling Julia directly from a callback. |
| Keep native lifecycle reliable | The Julia launcher owns the window, event-loop pumping, binding registration, graceful close, and pending-write flush. |
| Keep change safe | The repository has focused Julia and frontend tests for backend contracts, persistence, policy, jobs, paper projects, diagnostics, bridge behavior, and production UI/build verification. |
| Keep scope honest | This is a Linux desktop application using GTK/WebKit and a built-in WebView—not a hosted web app, cloud-sync platform, general browser, DAW, or unrestricted filesystem manager. |

## Intent-to-code map

| Pyramid layer | Primary locations |
| --- | --- |
| L1–L2: workspaces and user flows | `frontend/src/App.tsrx`, `WritingWorkspace.tsrx`, `MusicWorkspace.tsrx`, `MediaWorkspace.tsrx`, `DirectSearch.tsrx` |
| L3: project/content semantics | `src/PaperProjects.jl`, `src/pdf/PDFGen.jl`, `src/bibtex/BibTeX.jl`, `src/AudioAnalysisAdapter.jl`, `src/fs/FileTrees.jl` |
| L4: contracts, safety, operations | `src/Backend.jl`, `src/backend/`, `src/Persistence.jl`, `src/WorkspacePolicy.jl`, `src/Jobs.jl`, `src/Diagnostics.jl` |
| L5: desktop and build | `bin/webview_app.jl`, `src/ManualWebview.jl`, `native/bridge.cc`, `native/build_webview.sh`, `run.sh`, `frontend/rsbuild.config.js` |

## Design tests for future work

Before accepting a feature or architectural change, answer these in order:

1. Does it materially help the user produce, preserve, substantiate, or
   deliver a knowledge output (L1–L2)?
2. Does it have an explicit place in the paper/note/media/audio domain model
   and workflow (L3), rather than becoming isolated UI state?
3. Does it uphold local authority, bounded work, durability, responsive
   behavior, and actionable errors (L4)?
4. Can it be implemented through the existing frontend, backend, bridge, and
   test boundaries without weakening them (L5)?

If the first answer is no, it is out of scope. If a later answer is no, the
feature is not ready: strengthen the missing lower layer first.

## Current strategic focus

The pyramid points to three high-leverage areas:

1. **Close the paper authoring-to-delivery loop.** Expand the active Paper
   Desk from editing only a title, abstract, first section, and first TOC entry
   to editing the full validated project model; align export fidelity with the
   model, especially figures, tables, citations, and layout/profile choices.
2. **Connect supporting discovery intentionally.** Let selected research,
   media, and audio findings become explicit project inputs or provenance only
   through a deliberate user action, retaining source paths/metadata and
   permissions.
3. **Expose the trust layer in the product.** Surface project validation,
   workspace settings, recent projects, useful diagnostics, job progress, and
   recoverable failure guidance where users need them.

These are priorities, not claims that the capabilities are already complete.
