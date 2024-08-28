#ifndef __BS_BLE__
#define __BS_BLE__

#include <stdint.h>
#include <stdbool.h>

/**
 * Initialize BLE.
 */
void bs_ble_init();


/**
 * Send string via BLE.
 */
void bs_ble_send_notification(uint8_t *value, uint32_t length);

#endif /* __BS_BLE__ */