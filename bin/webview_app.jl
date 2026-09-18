#!/usr/bin/env julia

# Application entry point. Creates the native webview window, registers all
# frontend bindings on the request queue, and runs the event loop.

using WebViewApp
using WebViewApp.ManualWebview
using WebViewApp.Backend
using WebViewApp.BindingManifest
using JSON3

function webview_debug_enabled()
    value = lowercase(get(ENV, "JULIA_WEBVIEW_DEVTOOLS", get(ENV, "JULIA_WEBVIEW_DEBUG", "0")))
    return value in ("1", "true", "yes", "on")
end

function main()
    debug = webview_debug_enabled()
    debug && @info "WebView developer tools enabled"
    webview = ManualWebview.create(debug=debug)
    queue = ManualWebview.create_queue()
    ManualWebview.set_title!(webview, "WebView App")
    ManualWebview.set_size!(webview, 960, 640)

    # Register the stable frontend contract plus any plugin handlers that were
    # added during Julia startup. Window actions stay shell-owned below.
    # Window management bindings (minimize/maximize/restore/close) are handled
    # inline here because they need the webview handle, which Backend.jl
    # does not have access to.
    bindings = BindingManifest.required_bindings(Backend.handler_names())

    try
        for name in bindings
            ManualWebview.bind_queue!(webview, queue, name)
        end
        ManualWebview.html!(webview, frontend_html())

        # ── Main event loop ──────────────────────────────────────────────
        # A blocking GLib iteration waits efficiently for the next UI event.
        # Binding callbacks run in that iteration and enqueue requests, which
        # are then drained as one burst before waiting again. This keeps GTK
        # thread-affinity intact and replaces the former 10ms idle poll.
        # next!() pops a request from the bridge queue (or returns nothing).
        # All pending requests are drained before the next blocking iteration.
        closed = false
        while !closed
            ManualWebview.pump!(block=true)
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
            closed = !ManualWebview.is_open(webview)
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
