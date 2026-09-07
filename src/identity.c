#define NAPI_VERSION 8
#include <node_api.h>
#include <errno.h>
#include <inttypes.h>
#include <limits.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include <libproc.h>
#include <sys/sysctl.h>

#define CHECK(call) do { if ((call) != napi_ok) { napi_throw_error(env, NULL, "Node-API failure"); return NULL; } } while (0)

static napi_value result(napi_env env, const char *status, int error) {
  napi_value object, value;
  CHECK(napi_create_object(env, &object));
  CHECK(napi_create_string_utf8(env, status, NAPI_AUTO_LENGTH, &value));
  CHECK(napi_set_named_property(env, object, "status", value));
  CHECK(napi_create_int32(env, error, &value));
  CHECK(napi_set_named_property(env, object, "errno", value));
  return object;
}

static napi_value read_identity(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1], value;
  napi_valuetype type;
  double input;
  CHECK(napi_get_cb_info(env, info, &argc, argv, NULL, NULL));
  if (argc != 1) {
    napi_throw_type_error(env, NULL, "Expected a positive PID");
    return NULL;
  }
  CHECK(napi_typeof(env, argv[0], &type));
  if (type != napi_number) {
    napi_throw_type_error(env, NULL, "Expected a numeric PID");
    return NULL;
  }
  CHECK(napi_get_value_double(env, argv[0], &input));
  if (!isfinite(input) || input < 1 || input > INT_MAX || floor(input) != input) {
    napi_throw_range_error(env, NULL, "Invalid PID");
    return NULL;
  }
  pid_t pid = (pid_t)input;
  struct proc_bsdinfo bsd = {0};
  errno = 0;
  int count = proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &bsd, sizeof(bsd));
  int error = errno;
  if (count != sizeof(bsd)) {
    return result(env, count <= 0 && error == ESRCH ? "gone" : "unknown", error);
  }
  if (bsd.pbi_pid != (uint32_t)pid || bsd.pbi_start_tvusec >= 1000000) {
    return result(env, "unknown", EIO);
  }
  char boot[64] = {0};
  size_t boot_size = sizeof(boot);
  if (sysctlbyname("kern.bootsessionuuid", boot, &boot_size, NULL, 0) != 0) {
    return result(env, "unknown", errno);
  }
  if (boot_size < 2 || boot_size > sizeof(boot) || boot[boot_size - 1] != '\0') {
    return result(env, "unknown", EIO);
  }
  napi_value object = result(env, "found", 0);
  if (object == NULL) return NULL;
  CHECK(napi_create_uint32(env, bsd.pbi_pid, &value));
  CHECK(napi_set_named_property(env, object, "pid", value));
  CHECK(napi_create_string_utf8(env, boot, NAPI_AUTO_LENGTH, &value));
  CHECK(napi_set_named_property(env, object, "bootId", value));
  char seconds[32], micros[32];
  snprintf(seconds, sizeof(seconds), "%" PRIu64, bsd.pbi_start_tvsec);
  snprintf(micros, sizeof(micros), "%" PRIu64, bsd.pbi_start_tvusec);
  CHECK(napi_create_string_utf8(env, seconds, NAPI_AUTO_LENGTH, &value));
  CHECK(napi_set_named_property(env, object, "seconds", value));
  CHECK(napi_create_string_utf8(env, micros, NAPI_AUTO_LENGTH, &value));
  CHECK(napi_set_named_property(env, object, "micros", value));
  return object;
}

NAPI_MODULE_INIT() {
  napi_value function;
  CHECK(napi_create_function(env, "read", NAPI_AUTO_LENGTH, read_identity, NULL, &function));
  CHECK(napi_set_named_property(env, exports, "read", function));
  return exports;
}
