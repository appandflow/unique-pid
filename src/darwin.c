#include "identity.h"
#include <errno.h>
#include <inttypes.h>
#include <stdio.h>
#include <ctype.h>
#include <libproc.h>
#include <sys/sysctl.h>

void observe_process(unsigned int pid, struct identity *result) {
  struct proc_bsdinfo bsd = {0};
  errno = 0;
  int count = proc_pidinfo((int)pid, PROC_PIDTBSDINFO, 0, &bsd, sizeof(bsd));
  if (count != sizeof(bsd)) {
    result->status = count <= 0 && errno == ESRCH ? "gone"
      : errno == EPERM || errno == EACCES ? "denied" : "unknown";
    return;
  }
  if (bsd.pbi_pid != pid || bsd.pbi_start_tvusec >= 1000000) return;
  size_t size = sizeof(result->boot);
  if (sysctlbyname("kern.bootsessionuuid", result->boot, &size, NULL, 0) != 0) {
    result->status = errno == EPERM || errno == EACCES ? "denied" : "unknown";
    return;
  }
  if (size < 2 || size > sizeof(result->boot) || result->boot[size - 1] != '\0') return;
  for (size_t i = 0; i < size; i++) result->boot[i] = (char)tolower((unsigned char)result->boot[i]);
  snprintf(result->start, sizeof(result->start), "%" PRIu64 ":%" PRIu64,
    bsd.pbi_start_tvsec, bsd.pbi_start_tvusec);
  result->status = "found";
}
