
#ifndef __BLUESCRIPT_BLUETOOTH__
#define __BLUESCRIPT_BLUETOOTH__


#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

void init_bluetooth();

void register_event_handlers(void (* handler1)(uint8_t*, int), void (* handler2)(uint8_t*, int), void (* handler3)(uint8_t*, int));

void send_notification(uint8_t *str, int length);

#endif /* __BLUESCRIPT_BLUETOOTH__ */
