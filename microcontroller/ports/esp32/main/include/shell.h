#ifndef __BS_SHELL__
#define __BS_SHELL__

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/**
 * Execute received code.
 */
void bs_shell_execute_code(uint8_t *code, int code_len);


/**
 * Soft reset.
 */
void bs_shell_soft_reset();


/**
 * A task for execute code.
 * It pops an entry-point from the execution queue and jupts to it.
 */
void bs_shell_task(void *arg);


#endif /* __BS_SHELL__ */