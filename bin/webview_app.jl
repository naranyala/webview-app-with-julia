#!/usr/bin/env julia

using JuliaStarter
using JuliaStarter.ManualWebview
using JSON3

function main()
    debug = get(ENV, "JULIA_WEBVIEW_DEBUG", "0") == "1"
    webview = ManualWebview.create(debug=debug)
    queue = ManualWebview.create_queue()
    ManualWebview.set_title!(webview, "Julia Starter")
    ManualWebview.set_size!(webview, 960, 640)

    try
        # Queue requests in native code instead of entering Julia from a C callback.
        ManualWebview.bind_queue!(webview, queue, "calculateFibonacci")
        ManualWebview.bind_queue!(webview, queue, "closeWindow")
        ManualWebview.bind_queue!(webview, queue, "closeApp")
        ManualWebview.html!(webview, frontend_html())

        closed = false
        while !closed
            ManualWebview.pump!()
            request = ManualWebview.next!(queue)
            while request !== nothing
                try
                    name = ManualWebview.request_name(request)
                    id = ManualWebview.request_id(request)
                    if name == "calculateFibonacci"
                        args = JSON3.read(ManualWebview.request_payload(request))
                        result = calculate_fibonacci(args[1])
                        ManualWebview.return!(webview, id, 0, JSON3.write(result))
                    elseif name == "closeWindow" || name == "closeApp"
                        ManualWebview.return!(webview, id, 0, "null")
                        closed = true
                    end
                catch err
                    ManualWebview.return!(webview, ManualWebview.request_id(request), 1, JSON3.write(sprint(showerror, err)))
                finally
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
