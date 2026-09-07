{
  "targets": [{
    "target_name": "identity",
    "sources": ["src/identity.c"],
    "defines": ["NAPI_VERSION=8"],
    "xcode_settings": {
      "GCC_C_LANGUAGE_STANDARD": "c11",
      "WARNING_CFLAGS": ["-Wall", "-Wextra", "-Werror"]
    }
  }]
}
