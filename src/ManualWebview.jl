module ManualWebview

using Libdl

export Queue, Request, Window, bind_queue!, create, create_queue, destroy!, destroy_queue!, eval!, html!, init!, is_open, next!, pump!, request_id, request_name, request_payload, return!, run!, set_size!, set_title!, terminate!

const DEFAULT_LIBRARY = joinpath(dirname(@__DIR__), "native", "lib", "libwebview.so")
const DEFAULT_BRIDGE_LIBRARY = joinpath(dirname(@__DIR__), "native", "lib", "libjulia_webview_bridge.so")
const LIBRARY = get(ENV, "JULIA_WEBVIEW_LIBRARY", DEFAULT_LIBRARY)
const BRIDGE_LIBRARY = get(ENV, "JULIA_WEBVIEW_BRIDGE_LIBRARY", DEFAULT_BRIDGE_LIBRARY)
const GLIB_LIBRARY = "libglib-2.0.so.0"

mutable struct Window
    handle::Ptr{Cvoid}
end

mutable struct Queue
    handle::Ptr{Cvoid}
end

struct Request
    handle::Ptr{Cvoid}
end

function ensure_library()
    for (library, label) in ((LIBRARY, "webview"), (BRIDGE_LIBRARY, "binding bridge"))
        handle = Libdl.dlopen_e(library)
        handle == C_NULL && error(
            "Could not load the native $label library at `$library`. " *
            "Run `./native/build_webview.sh` after installing the system dependencies, " *
            "or set the matching JULIA_WEBVIEW_*_LIBRARY environment variable."
        )
        Libdl.dlclose(handle)
    end
    nothing
end

function check(code::Cint, operation::AbstractString)
    code == 0 || error("$operation failed with webview error code $code")
    nothing
end

function create(; debug::Bool=false)
    ensure_library()
    handle = ccall(
        (:webview_create, LIBRARY),
        Ptr{Cvoid},
        (Cint, Ptr{Cvoid}),
        debug ? 1 : 0,
        C_NULL,
    )
    handle == C_NULL && error("webview_create failed; check your desktop and native WebView runtime")
    window = Window(handle)
    finalizer(destroy!, window)
    return window
end

function destroy!(window::Window)
    window.handle == C_NULL && return nothing
    ccall((:webview_destroy, LIBRARY), Cint, (Ptr{Cvoid},), window.handle)
    window.handle = C_NULL
    nothing
end

function create_queue()
    queue = Queue(ccall((:julia_webview_queue_create, BRIDGE_LIBRARY), Ptr{Cvoid}, ()))
    queue.handle == C_NULL && error("julia_webview_queue_create failed")
    finalizer(destroy_queue!, queue)
    return queue
end

function destroy_queue!(queue::Queue)
    queue.handle == C_NULL && return nothing
    ccall((:julia_webview_queue_destroy, BRIDGE_LIBRARY), Cvoid, (Ptr{Cvoid},), queue.handle)
    queue.handle = C_NULL
    nothing
end

function run!(window::Window)
    check(ccall((:webview_run, LIBRARY), Cint, (Ptr{Cvoid},), window.handle), "webview_run")
    nothing
end

function is_open(window::Window)
    window.handle == C_NULL && return false
    return ccall((:webview_get_window, LIBRARY), Ptr{Cvoid}, (Ptr{Cvoid},), window.handle) != C_NULL
end

function terminate!(window::Window)
    check(
        ccall((:webview_terminate, LIBRARY), Cint, (Ptr{Cvoid},), window.handle),
        "webview_terminate",
    )
    nothing
end

function pump!()
    return ccall((:g_main_context_iteration, GLIB_LIBRARY), Cint, (Ptr{Cvoid}, Cint), C_NULL, 0)
end

function set_title!(window::Window, title::AbstractString)
    check(
        ccall((:webview_set_title, LIBRARY), Cint, (Ptr{Cvoid}, Cstring), window.handle, title),
        "webview_set_title",
    )
    window
end

function set_size!(window::Window, width::Integer, height::Integer)
    code = ccall(
        (:webview_set_size, LIBRARY),
        Cint,
        (Ptr{Cvoid}, Cint, Cint, Cint),
        window.handle,
        width,
        height,
        0,
    )
    # webview 0.12.0's GTK backend resizes successfully but returns -2 afterward.
    code == 0 || code == -2 || error("webview_set_size failed with webview error code $code")
    window
end

function html!(window::Window, html::AbstractString)
    check(
        ccall((:webview_set_html, LIBRARY), Cint, (Ptr{Cvoid}, Cstring), window.handle, html),
        "webview_set_html",
    )
    window
end

function init!(window::Window, javascript::AbstractString)
    check(
        ccall((:webview_init, LIBRARY), Cint, (Ptr{Cvoid}, Cstring), window.handle, javascript),
        "webview_init",
    )
    window
end

function eval!(window::Window, javascript::AbstractString)
    check(
        ccall((:webview_eval, LIBRARY), Cint, (Ptr{Cvoid}, Cstring), window.handle, javascript),
        "webview_eval",
    )
    window
end

function bind_queue!(window::Window, queue::Queue, name::AbstractString)
    check(
        ccall(
            (:julia_webview_bind_queue, BRIDGE_LIBRARY),
            Cint,
            (Ptr{Cvoid}, Cstring, Ptr{Cvoid}),
            window.handle,
            name,
            queue.handle,
        ),
        "julia_webview_bind_queue($name)",
    )
    window
end

function next!(queue::Queue)
    handle = ccall((:julia_webview_queue_next, BRIDGE_LIBRARY), Ptr{Cvoid}, (Ptr{Cvoid},), queue.handle)
    handle == C_NULL ? nothing : Request(handle)
end

function request_name(request::Request)
    return unsafe_string(ccall((:julia_webview_request_name, BRIDGE_LIBRARY), Cstring, (Ptr{Cvoid},), request.handle))
end

function request_id(request::Request)
    return unsafe_string(ccall((:julia_webview_request_id, BRIDGE_LIBRARY), Cstring, (Ptr{Cvoid},), request.handle))
end

function request_payload(request::Request)
    return unsafe_string(ccall((:julia_webview_request_payload, BRIDGE_LIBRARY), Cstring, (Ptr{Cvoid},), request.handle))
end

function Base.close(request::Request)
    ccall((:julia_webview_request_destroy, BRIDGE_LIBRARY), Cvoid, (Ptr{Cvoid},), request.handle)
    nothing
end

function return!(window::Window, id::AbstractString, status::Integer, result::AbstractString)
    check(
        ccall(
            (:webview_return, LIBRARY),
            Cint,
            (Ptr{Cvoid}, Cstring, Cint, Cstring),
            window.handle,
            id,
            status,
            result,
        ),
        "webview_return",
    )
    nothing
end

end
