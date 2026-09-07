#define NAPI_VERSION 8
#include <node_api.h>
#include <limits.h>
#include <math.h>
#include <string.h>
#include "identity.h"

#define CHECK(call) do { if ((call) != napi_ok) { napi_throw_error(env, NULL, "Node-API failure"); return NULL; } } while (0)

static napi_value read_identity(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1], object, value;
  napi_valuetype type;
  double input = 0;
  CHECK(napi_get_cb_info(env, info, &argc, argv, NULL, NULL));
  struct identity found = {0};
  found.status = "unknown";
  if (argc == 1) {
    CHECK(napi_typeof(env, argv[0], &type));
    if (type == napi_number) {
      CHECK(napi_get_value_double(env, argv[0], &input));
      if (isfinite(input) && input >= 1 && input <= INT_MAX && floor(input) == input) {
        observe_process((unsigned int)input, &found);
      }
    }
  }
  CHECK(napi_create_object(env, &object));
  CHECK(napi_create_string_utf8(env, found.status, NAPI_AUTO_LENGTH, &value));
  CHECK(napi_set_named_property(env, object, "status", value));
  if (strcmp(found.status, "found") != 0) return object;
  CHECK(napi_create_string_utf8(env, found.start, NAPI_AUTO_LENGTH, &value));
  CHECK(napi_set_named_property(env, object, "startTime", value));
  if (found.boot[0]) {
    CHECK(napi_create_string_utf8(env, found.boot, NAPI_AUTO_LENGTH, &value));
  } else {
    CHECK(napi_get_null(env, &value));
  }
  CHECK(napi_set_named_property(env, object, "bootId", value));
  return object;
}

NAPI_MODULE_INIT() {
  napi_value function;
  CHECK(napi_create_function(env, "read", NAPI_AUTO_LENGTH, read_identity, NULL, &function));
  CHECK(napi_set_named_property(env, exports, "read", function));
  return exports;
}
