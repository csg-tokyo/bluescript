#ifndef __BS_SHELL__
#define __BS_SHELL__

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define PORT_TEXT_SECTION __attribute__((section(".port_text")))

/**
 * Set data.
 */
void bs_shell_receptionist(uint8_t *task_data, int data_len);


/**
 * Register result sender.  
 */
void bs_shell_register_sender(void (* sender)(uint8_t*, uint32_t));




/**
 * Push a callback function event to the event queue.
 */
void PORT_TEXT_SECTION bs_event_push(void *callback);


/**
 * Push a callback function event to the event queue from isr.
 */
void PORT_TEXT_SECTION bs_event_push_from_isr(void *callback);


/**
 * A task for execute code.
 * It pops an entry-point from the execution queue and jupts to it.
 */
void bs_shell_task(void *arg);


#endif /* __BS_SHELL__ */