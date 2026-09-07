#ifndef UNIQUE_PID_IDENTITY_H
#define UNIQUE_PID_IDENTITY_H
struct identity {
  const char *status;
  char start[64];
  char boot[64];
};
void observe_process(unsigned int pid, struct identity *result);
#endif
