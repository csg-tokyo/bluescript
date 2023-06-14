#ifndef __BLUESCRIPT_LOG__
#define __BLUESCRIPT_LOG__
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void push_log(char *log);

void send_log_task(void *arg);

#endif /* __BLUESCRIPT_LOG__ */
