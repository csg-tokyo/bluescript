
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_system.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_bt.h"

#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "esp_bt_main.h"
#include "esp_gatt_common_api.h"

#include "write_value.h"
#include "my_utils.h"
#include <sys/time.h>


#define GATTS_TABLE_TAG "CODE_SEND_DEMO"


uint8_t __attribute__((section(".iram0.data"))) my_text[1000] = {0x36, 0x41, 0x00, 0x0c, 0x22, 0x1d, 0xf0, 0x00};
int my_literal_size = 100; // literalは必ずtext領域の最初にくる。
uint8_t exec_func_num;
uint8_t exec_func_offsets[20];
int can_exec = 0;

uint8_t my_data[1000];
uint8_t my_rodata[1000];
uint8_t my_bss[200];


int text_used_memory_size = 0;
int literal_used_memory_size = 0;
int data_used_memory_size = 0;
int rodata_used_memory_size = 0;
int bss_used_memory_size = 0;


// 順々に送られてきたコードを追加して、指定された関数を実行する場所。
void write_value_A(uint8_t *value, int value_len) {
    ESP_LOGI(GATTS_TABLE_TAG, "Write Value B");
    esp_log_buffer_hex(GATTS_TABLE_TAG, value, value_len);

    uint8_t text_size = value[0];
    uint8_t literal_size = value[1];
    uint8_t data_size = value[2];
    uint8_t rodata_size = value[3];
    uint8_t bss_size = value[4];
    exec_func_num = value[5];
    int next_index = 6;
    for (uint8_t i = 0; i < exec_func_num; i++)
    {
        exec_func_offsets[i] = value[next_index];
        next_index++;
    }

    memcpy(my_text + literal_used_memory_size, value + next_index + text_size, literal_size); // literal
    memcpy(my_text + my_literal_size + text_used_memory_size, value + next_index, text_size); // text
    memcpy(my_data + data_used_memory_size, value + next_index + text_size + literal_size, data_size); // data
    memcpy(my_rodata + rodata_used_memory_size, value + next_index + text_size + literal_size + data_size, rodata_size); // rodata
    // memcpy(my_bss + bss_used_memory_size, value + next_index + text_size + literal_size + data_size + rodata_size, bss_size); // bss

    text_used_memory_size += text_size;
    literal_used_memory_size += literal_size;
    data_used_memory_size += data_size;
    rodata_used_memory_size += rodata_size;
    bss_used_memory_size += bss_size;

    can_exec = 1;
}

// まとめて送られてきたコードを関数としてただ実行する場所。
void write_value_B(uint8_t *value, int value_len) {
    ESP_LOGI(GATTS_TABLE_TAG, "Write Value B");
    esp_log_buffer_hex(GATTS_TABLE_TAG, value, value_len);
    // 安全のため初期化
    memset(my_text, 0, sizeof(my_text));
    memset(my_data, 0, sizeof(my_data));
    memset(my_rodata, 0, sizeof(my_rodata));
    memset(my_bss, 0, sizeof(my_bss));

    uint8_t text_size = value[0];
    uint8_t literal_size = value[1];
    uint8_t data_size = value[2];
    uint8_t rodata_size = value[3];
    uint8_t bss_size = value[4];
    exec_func_num = 1;
    exec_func_offsets[0] = value[5];

    int next_index = 6;

    memcpy(my_text, value + next_index + text_size, literal_size); // literal
    memcpy(my_text + my_literal_size, value + next_index, text_size); // text
    memcpy(my_data, value + next_index + text_size + literal_size, data_size); // data
    memcpy(my_rodata, value + next_index + text_size + literal_size + data_size, rodata_size); // rodata
    memcpy(my_bss, value + next_index + text_size + literal_size + data_size + rodata_size, bss_size); //bss

    can_exec = 1;
}

// Clear
void write_value_C(uint8_t *value, int value_len) {
    ESP_LOGI(GATTS_TABLE_TAG, "Write Value C");
    // 初期化
    memset(my_text, 0, sizeof(my_text));
    memset(my_data, 0, sizeof(my_data));
    memset(my_rodata, 0, sizeof(my_rodata));
    memset(my_bss, 0, sizeof(my_bss));
    text_used_memory_size = 0;
    literal_used_memory_size = 0;
    data_used_memory_size = 0;
    rodata_used_memory_size = 0;
    bss_used_memory_size = 0;
}