#!/usr/bin/env julia

# Application entry point. Creates the native webview window, registers all
# frontend bindings on the request queue, and runs the event loop.

using JuliaStarter
using JuliaStarter.ManualWebview
using JuliaStarter.Backend
using JSON3

function main()
    debug = get(ENV, "JULIA_WEBVIEW_DEBUG", "0") == "1"
    webview = ManualWebview.create(debug=debug)
    queue = ManualWebview.create_queue()
    ManualWebview.set_title!(webview, "Julia Starter")
    ManualWebview.set_size!(webview, 960, 640)

    # All bindings the frontend expects are registered on the queue.
    # Window management bindings (minimize/maximize/restore/close) are handled
    # inline here because they need the webview handle, which Backend.jl
    # does not have access to.
    bindings = [
        "increment", "reset", "getSystemInfo", "getTimestamp", "getStatus",
        "getNotes", "createNote", "updateNote", "deleteNote", "savePdf",
        "quizList", "quizCreateCollection", "quizUpdateCollection",
        "quizDeleteCollection", "quizCreateQuestion", "quizUpdateQuestion",
        "quizDeleteQuestion", "quizExport", "quizImport", "mirAnalyze",
        "listVolumes", "startAssetScan", "getAssetScanStatus", "cancelAssetScan",
        "getAudioMetadata", "analyzeAudio", "startAudioAnalysis",
        "getAudioAnalysisStatus", "cancelAudioAnalysis",
        "parseBibTeX", "inspectBlend", "generatePdf",
        # Optional StaticMediaCompanion capabilities. These are registered
        # independently from the 36 core bindings so the shell can ship the
        # media backend before a dedicated media-inspector plugin is enabled.
        "inspectMedia", "markdownToHtml", "readText", "writeText",
        "planConversion", "convertMedia", "getMediaCapabilities", "htmlToText",
        "minimizeWindow", "maximizeWindow", "restoreWindow", "closeWindow",
    ]

    try
        for name in bindings
            ManualWebview.bind_queue!(webview, queue, name)
        end
        ManualWebview.html!(webview, frontend_html())

        # ── Main event loop ──────────────────────────────────────────────
        # pump!() processes pending GTK events (non-blocking GLib iteration).
        # next!() pops a request from the bridge queue (or returns nothing).
        # All pending requests are drained before sleeping. The 10ms sleep
        # balances latency (~10ms worst-case) against CPU usage (~100 Hz poll).
        # A future improvement will replace this with epoll-based wakeup.
        closed = false
        while !closed
            ManualWebview.pump!()
            request = ManualWebview.next!(queue)
            while request !== nothing
                try
                    name = ManualWebview.request_name(request)
                    id = ManualWebview.request_id(request)
                    payload = ManualWebview.request_payload(request)

                    if name == "closeWindow" || name == "closeApp"
                        ManualWebview.return!(webview, id, 0, "null")
                        ManualWebview.close!(webview)
                        closed = true
                    elseif name == "minimizeWindow"
                        ManualWebview.minimize!(webview)
                        ManualWebview.return!(webview, id, 0, "null")
                    elseif name == "maximizeWindow" || name == "restoreWindow"
                        name == "maximizeWindow" ? ManualWebview.maximize!(webview) : ManualWebview.restore!(webview)
                        ManualWebview.return!(webview, id, 0, "null")
                    else
                        status, result = Backend.handle_request(name, payload)
                        ManualWebview.return!(webview, id, status, result)
                    end
                catch err
                    ManualWebview.return!(webview, ManualWebview.request_id(request), 1,
                        JSON3.write(Dict("code" => "InternalError", "message" => sprint(showerror, err))))
                finally
                    # Always release the request memory, even on error.
                    Base.close(request)
                end
                request = ManualWebview.next!(queue)
            end
            sleep(0.01)
        end
    finally
        ManualWebview.destroy_queue!(queue)
        ManualWebview.destroy!(webview)
    end
end

main()
