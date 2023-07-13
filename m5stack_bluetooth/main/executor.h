#ifndef __EXECUTOR__
#define __EXECUTOR__
#include <stdio.h>
#include <stdlib.h>
#include <string.h>


void executor_set_repl(uint8_t *value, int value_len);
void executor_set_onetime(uint8_t *value, int value_len);
void executor_crear(uint8_t *value, int value_len);


void exec_code_task(void *arg);

#endif /* __EXECUTOR__ */