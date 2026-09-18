// native/bridge.cc
//
// C++ bridge between webview.h callbacks and the Julia FFI.
//
// Architecture:
//   webview.h binds JavaScript function names to C callbacks. When the frontend
//   calls e.g. `window.getNotes()` webview invokes `binding_callback` on the
//   GTK main thread. We queue each request into a thread-safe deque. The Julia
//   main loop drains the deque on its own thread via `julia_webview_queue_next`.
//
// Thread safety:
//   `binding_callback` runs on GTK's main thread. `julia_webview_queue_next`
//   and `julia_webview_request_*` run on the Julia thread. The mutex in
//   bridge_queue synchronizes access to the request deque. This is the ONLY
//   synchronization point — no Julia GIL assumption is made.
//
// Memory ownership:
//   bridge_queue is heap-allocated and owned by Julia (created/destroyed via
//   ccall). Each binding_context is heap-allocated and owned by the queue.
//   julia_webview_queue_next moves the front request to a heap-allocated copy;
//   the Julia caller MUST call julia_webview_request_destroy to free it.
//   Window operation functions cast webview_get_window to GtkWindow* — this
//   is Linux/GTK-specific and will not compile on macOS/Windows.

#include <webview.h>

#include <gtk/gtk.h>

#include <deque>
#include <cstring>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

// A single request from the frontend, queued when a binding is invoked.
struct bridge_request {
  std::string name;    // binding name (e.g. "getNotes")
  std::string id;      // opaque request ID for webview_return
  std::string payload; // JSON arguments from the frontend
};

// Thread-safe request queue shared between the GTK and Julia threads.
struct bridge_queue {
  std::mutex mutex;
  std::deque<bridge_request> requests;  // pending requests
  std::vector<void *> contexts;         // owned binding_context pointers (for cleanup)
};

// Keep a slow Julia handler or a malicious page from retaining unbounded input
// in the native process.  Payloads are JSON argument arrays and the backend has
// its own smaller per-operation limits; this is the bridge-wide last line of
// defence.
constexpr std::size_t kMaxPendingRequests = 128;
constexpr std::size_t kMaxPayloadBytes = 1024 * 1024;

// Associates a binding name with its owning queue. One per bound name.
struct binding_context {
  bridge_queue *queue;
  webview_t webview;
  std::string name;
};

extern "C" {

// Callback invoked by webview on the GTK thread when a frontend binding fires.
// Acquires the queue mutex and appends the request; no Julia code is called.
static void binding_callback(const char *id, const char *payload, void *arg) {
  auto *context = static_cast<binding_context *>(arg);
  const char *safe_id = id ? id : "";
  const char *safe_payload = payload ? payload : "";
  int enqueue_result = 0;
  {
    std::lock_guard<std::mutex> lock(context->queue->mutex);
    if (context->queue->requests.size() >= kMaxPendingRequests) {
      enqueue_result = -1;
    } else if (std::strlen(safe_payload) > kMaxPayloadBytes) {
      enqueue_result = -2;
    } else {
      context->queue->requests.push_back(
          {context->name, safe_id, safe_payload});
    }
  }

  // The callback is already on WebView's UI thread, so return overload errors
  // immediately instead of making a browser Promise wait for a queue slot.
  if (enqueue_result == -1) {
    webview_return(context->webview, safe_id, 1,
                   "{\"code\":\"BridgeOverloaded\",\"message\":\"The desktop request queue is full. Try again shortly.\"}");
  } else if (enqueue_result == -2) {
    webview_return(context->webview, safe_id, 1,
                   "{\"code\":\"PayloadTooLarge\",\"message\":\"The request payload exceeds the bridge limit.\"}");
  }
}

// ── Queue lifecycle ────────────────────────────────────────────────────────

// Allocate a new empty queue. The caller (Julia) owns the returned pointer
// and must call julia_webview_queue_destroy when done.
void *julia_webview_queue_create() { return new bridge_queue{}; }

// Free the queue and all its owned binding_context pointers.
// Safe to call with nullptr.
void julia_webview_queue_destroy(void *queue_pointer) {
  if (!queue_pointer) {
    return;
  }

  auto *queue = static_cast<bridge_queue *>(queue_pointer);
  for (auto *context : queue->contexts) {
    delete static_cast<binding_context *>(context);
  }
  delete queue;
}

// Bind a frontend function name to the queue. When the frontend calls `name`,
// binding_callback queues a request. Returns -2 on null inputs, or the webview
// error code on failure.
int julia_webview_bind_queue(webview_t webview, const char *name,
                             void *queue_pointer) {
  if (!webview || !name || !queue_pointer) {
    return -2;
  }

  auto *queue = static_cast<bridge_queue *>(queue_pointer);
  auto *context = new binding_context{queue, webview, name};
  auto result = webview_bind(webview, name, binding_callback, context);
  if (result != WEBVIEW_ERROR_OK) {
    delete context;
    return result;
  }

  queue->contexts.push_back(context);
  return WEBVIEW_ERROR_OK;
}

// ── Window operations (Linux/GTK-specific) ────────────────────────────────
// These cast webview_get_window to GtkWindow* — platform-dependent.

int julia_webview_window_minimize(webview_t webview) {
  auto *window = static_cast<GtkWindow *>(webview_get_window(webview));
  if (!window) {
    return -2;
  }
  gtk_window_iconify(window);
  return 0;
}

int julia_webview_window_maximize(webview_t webview) {
  auto *window = static_cast<GtkWindow *>(webview_get_window(webview));
  if (!window) {
    return -2;
  }
  gtk_window_maximize(window);
  return 0;
}

int julia_webview_window_restore(webview_t webview) {
  auto *window = static_cast<GtkWindow *>(webview_get_window(webview));
  if (!window) {
    return -2;
  }
  gtk_window_unmaximize(window);
  return 0;
}

int julia_webview_window_close(webview_t webview) {
  auto *window = static_cast<GtkWindow *>(webview_get_window(webview));
  if (!window) {
    return -2;
  }
  gtk_window_close(window);
  return 0;
}

// ── Request consumption ───────────────────────────────────────────────────
// julia_webview_queue_next moves the front request to a heap-allocated copy
// and returns it. The Julia caller MUST call julia_webview_request_destroy.
// Returns nullptr when the queue is empty.

void *julia_webview_queue_next(void *queue_pointer) {
  if (!queue_pointer) {
    return nullptr;
  }

  auto *queue = static_cast<bridge_queue *>(queue_pointer);
  std::lock_guard<std::mutex> lock(queue->mutex);
  if (queue->requests.empty()) {
    return nullptr;
  }

  auto *request = new bridge_request{std::move(queue->requests.front())};
  queue->requests.pop_front();
  return request;
}

// Testable queue primitive used by the binding callback.  It does not call
// into WebView, which lets the Julia integration test exercise bounded burst
// handling without a display server.
// Returns 0 on success, -1 when full, -2 for an oversized payload, and -3 for
// invalid pointers.
int julia_webview_queue_try_push(void *queue_pointer, const char *name,
                                 const char *id, const char *payload) {
  if (!queue_pointer || !name || !id || !payload) {
    return -3;
  }
  if (std::strlen(payload) > kMaxPayloadBytes) {
    return -2;
  }
  auto *queue = static_cast<bridge_queue *>(queue_pointer);
  std::lock_guard<std::mutex> lock(queue->mutex);
  if (queue->requests.size() >= kMaxPendingRequests) {
    return -1;
  }
  queue->requests.push_back({name, id, payload});
  return 0;
}

std::size_t julia_webview_queue_capacity() { return kMaxPendingRequests; }

std::size_t julia_webview_queue_size(void *queue_pointer) {
  if (!queue_pointer) {
    return 0;
  }
  auto *queue = static_cast<bridge_queue *>(queue_pointer);
  std::lock_guard<std::mutex> lock(queue->mutex);
  return queue->requests.size();
}

// ── Request accessors ─────────────────────────────────────────────────────
// These return pointers into the request's std::string storage. The returned
// pointers are valid until julia_webview_request_destroy is called.

const char *julia_webview_request_name(void *request_pointer) {
  return static_cast<bridge_request *>(request_pointer)->name.c_str();
}

const char *julia_webview_request_id(void *request_pointer) {
  return static_cast<bridge_request *>(request_pointer)->id.c_str();
}

const char *julia_webview_request_payload(void *request_pointer) {
  return static_cast<bridge_request *>(request_pointer)->payload.c_str();
}

void julia_webview_request_destroy(void *request_pointer) {
  delete static_cast<bridge_request *>(request_pointer);
}

}
