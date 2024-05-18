#ifndef __BS_EVENT__
#define __BS_EVENT__


/**
 * Push a callback function event to the event queue.
 */
void bs_event_push(void *callback);


/**
 * Push a callback function event to the event queue from isr.
 */
void bs_event_push_from_isr(void *callback);

/**
 * A task for handling the events.
 */
void bs_event_handler_task(void *arg);


#endif /* __BS_EVENT__ */
