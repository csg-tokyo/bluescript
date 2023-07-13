#ifndef __BLUETOOTH__
#define __BLUETOOTH__
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void init_bluetooth();

void register_event_handler(int index, void (* handler)(uint8_t*, int));

void send_notification(uint8_t *str, int length);

#endif /* __BLUETOOTH__ */
