#include <webview.h>

#include <deque>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

struct bridge_request {
  std::string name;
  std::string id;
  std::string payload;
};

struct bridge_queue {
  std::mutex mutex;
  std::deque<bridge_request> requests;
  std::vector<void *> contexts;
};

struct binding_context {
  bridge_queue *queue;
  std::string name;
};

extern "C" {

static void binding_callback(const char *id, const char *payload, void *arg) {
  auto *context = static_cast<binding_context *>(arg);
  std::lock_guard<std::mutex> lock(context->queue->mutex);
  context->queue->requests.push_back(
      {context->name, id ? id : "", payload ? payload : ""});
}

void *julia_webview_queue_create() { return new bridge_queue{}; }

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

int julia_webview_bind_queue(webview_t webview, const char *name,
                             void *queue_pointer) {
  if (!webview || !name || !queue_pointer) {
    return -2;
  }

  auto *queue = static_cast<bridge_queue *>(queue_pointer);
  auto *context = new binding_context{queue, name};
  auto result = webview_bind(webview, name, binding_callback, context);
  if (result != WEBVIEW_ERROR_OK) {
    delete context;
    return result;
  }

  queue->contexts.push_back(context);
  return WEBVIEW_ERROR_OK;
}

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
