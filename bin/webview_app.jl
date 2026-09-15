#!/usr/bin/env julia

# Application entry point. Creates the native webview window, registers all
# frontend bindings on the request queue, and runs the event loop.

using WebViewApp
using WebViewApp.ManualWebview
using WebViewApp.Backend
using JSON3

function main()
    debug = get(ENV, "JULIA_WEBVIEW_DEBUG", "0") == "1"
    webview = ManualWebview.create(debug=debug)
    queue = ManualWebview.create_queue()
    ManualWebview.set_title!(webview, "WebView App")
    ManualWebview.set_size!(webview, 960, 640)

    # Register the stable frontend contract plus any plugin handlers that were
    # added during Julia startup. Window actions stay shell-owned below.
    # Window management bindings (minimize/maximize/restore/close) are handled
    # inline here because they need the webview handle, which Backend.jl
    # does not have access to.
    bindings = [
        "increment", "reset", "getSystemInfo", "getTimestamp", "getStatus",
        "getDiagnostics", "clearDiagnostics",
        "getNotes", "createNote", "updateNote", "deleteNote", "savePdf",
        "mirAnalyze",
        "listVolumes", "startAssetScan", "getAssetScanStatus", "cancelAssetScan",
        "getAudioMetadata", "analyzeAudio", "startAudioAnalysis",
        "getAudioAnalysisStatus", "cancelAudioAnalysis",
        "parseBibTeX", "inspectBlend", "generatePdf",
        # Optional StaticMediaCompanion capabilities. These are registered
        # independently from the 27 core bindings so the shell can ship the
        # media backend before a dedicated media-inspector plugin is enabled.
        "inspectMedia", "markdownToHtml", "readText", "writeText",
        "planConversion", "convertMedia", "startMediaConversion",
        "getMediaConversionStatus", "cancelMediaConversion",
        "getMediaCapabilities", "htmlToText",
        "minimizeWindow", "maximizeWindow", "restoreWindow", "closeWindow",
    ]
    append!(bindings, setdiff(Backend.handler_names(), bindings))

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

                    if name == "closeWindow"
                        if Backend.flush_pending!()
                            ManualWebview.return!(webview, id, 0, "null")
                            ManualWebview.close!(webview)
                            closed = true
                        else
                            ManualWebview.return!(webview, id, 1, JSON3.write(Dict(
                                "code" => "StorageWriteFailed",
                                "message" => "Pending changes could not be saved.",
                            )))
                        end
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
        try
            Backend.flush_pending!()
        finally
            ManualWebview.destroy_queue!(queue)
            ManualWebview.destroy!(webview)
        end
    end
end

main()
