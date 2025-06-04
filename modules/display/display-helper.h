#ifndef __BS_Display_Helper__
#define __BS_Display_Helper__

#include <stdint.h>

void display_init();

uint16_t display_color(int32_t r, int32_t g, int32_t b);

void display_fill(uint16_t color);

void display_show_heart_icon(uint16_t color, uint16_t background);

void display_show_small_heart_icon(uint16_t color, uint16_t background);

void display_show_happy_face_icon(uint16_t color, uint16_t background);

void display_show_sad_face_icon(uint16_t color, uint16_t background);

void display_show_string(char* str, uint16_t color, uint16_t background);

void display_show_integer(int32_t integer, uint16_t color, uint16_t background);

#endif /* __BS_Display_Helper__ */
