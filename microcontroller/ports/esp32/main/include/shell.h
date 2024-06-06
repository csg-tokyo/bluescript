#ifndef __BS_SHELL__
#define __BS_SHELL__

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/**
 * Set data.
 */
void bs_shell_set_tasks(uint8_t *task_data, int data_len);


/**
 * A task for execute code.
 * It pops an entry-point from the execution queue and jupts to it.
 */
void bs_shell_task(void *arg);


#endif /* __BS_SHELL__ */