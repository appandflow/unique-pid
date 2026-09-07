#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <inttypes.h>
#include <stdio.h>
#include "identity.h"

void observe_process(unsigned int pid, struct identity *result) {
  HANDLE handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, FALSE, (DWORD)pid);
  if (handle == NULL) {
    DWORD error = GetLastError();
    result->status = error == ERROR_INVALID_PARAMETER ? "gone"
      : error == ERROR_ACCESS_DENIED ? "denied" : "unknown";
    return;
  }
  FILETIME creation, exit_time, kernel, user;
  if (!GetProcessTimes(handle, &creation, &exit_time, &kernel, &user)) {
    result->status = GetLastError() == ERROR_ACCESS_DENIED ? "denied" : "unknown";
    CloseHandle(handle);
    return;
  }
  DWORD state = WaitForSingleObject(handle, 0);
  if (state == WAIT_TIMEOUT) {
    uint64_t ticks = ((uint64_t)creation.dwHighDateTime << 32) | creation.dwLowDateTime;
    snprintf(result->start, sizeof(result->start), "%" PRIu64, ticks);
    result->status = "found";
  } else {
    result->status = state == WAIT_OBJECT_0 ? "gone" : "unknown";
  }
  CloseHandle(handle);
}
