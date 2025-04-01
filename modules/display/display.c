
#include <stdint.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "display-helper.c"
#include "display.h"

#define BS_DISPLAY_TAG  "BS_DISPLAY"

#define BS_DISPLAY_ICON_HEART       0
#define BS_DISPLAY_ICON_SMALL_HEART 1
#define BS_DISPLAY_ICON_HAPPY_FACE  2
#define BS_DISPLAY_ICON_SAD_FACE    3

value_t new_000002Display(value_t self);
void mth_0_000002Display(value_t self);
void mth_1_000002Display(value_t self, int32_t _color);
void mth_2_000002Display(value_t self, int32_t _icon, int32_t _color, int32_t _background);
void mth_3_000002Display(value_t self, value_t _str, int32_t _color, int32_t _background);
void mth_4_000002Display(value_t self, int32_t _int, int32_t _color, int32_t _background);
int32_t mth_5_000002Display(value_t self, int32_t _r, int32_t _g, int32_t _b);
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_000002();
ROOT_SET_DECL(global_rootset0_000002, 0);
static const uint16_t plist_000002Display[] = { 1, 2, 3, 4 };

class_000002Display_t class_000002Display = {
    .body = { 
      .s = 4, 
      .i = 4, 
      .cn = "000002Display", 
      .sc = &object_class.clazz , 
      .f = 0, 
      .pt = { 
        .size = 4, .offset = 0,
        .unboxed = 4, 
        .prop_names = plist_000002Display, 
        .unboxed_types = "iiii" 
      }, 
      .vtbl = { mth_0_000002Display, mth_1_000002Display, mth_2_000002Display, mth_3_000002Display, mth_4_000002Display, mth_5_000002Display}
    }
};

static void cons_000002Display(value_t self) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    *get_obj_int_property(self, 0) = BS_DISPLAY_ICON_HEART;
    *get_obj_int_property(self, 1) = BS_DISPLAY_ICON_SMALL_HEART;
    *get_obj_int_property(self, 2) = BS_DISPLAY_ICON_HAPPY_FACE;
    *get_obj_int_property(self, 3) = BS_DISPLAY_ICON_SAD_FACE;
    spi_init();
    gpio_init();
    mth_0_000002Display(0);
    int cmd = 0;
    //Send all the commands
    while (init_cmds[cmd].databytes!=0xff) {
        spi_write_cmd(init_cmds[cmd].cmd);
        spi_write_data(init_cmds[cmd].data, init_cmds[cmd].databytes&0x1F);
        if (init_cmds[cmd].databytes&0x80) {
            vTaskDelay(100 / portTICK_PERIOD_MS);
        }
        cmd++;
    }

    spi_write_cmd(MADCTL);
    uint8_t data[16] = {0x08};
    spi_write_data(data, 1&0x1F);
    spi_write_cmd(DISPLAY_INVERSION_ON);
    spi_write_cmd(WAKE);
    vTaskDelay(120 / portTICK_PERIOD_MS);
    spi_write_cmd(DISPLAY_ON);
    gpio_set_level(PIN_NUM_BCKL, 1);
    }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_000002Display(value_t self) { cons_000002Display(self); return self; }


// reset
void mth_0_000002Display(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    gpio_set_level(PIN_NUM_BCKL, 0);
    gpio_set_level(PIN_NUM_RST, 0);
    vTaskDelay(50 / portTICK_PERIOD_MS);
    gpio_set_level(PIN_NUM_RST, 1);
    vTaskDelay(50 / portTICK_PERIOD_MS);
  }
  DELETE_ROOT_SET(func_rootset)
}

// fill
void mth_1_000002Display(value_t self, int32_t _color) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    display_draw(fill, _color, _color);
  }
  DELETE_ROOT_SET(func_rootset)
}

// show icon
void mth_2_000002Display(value_t self, int32_t _icon, int32_t _color, int32_t _background) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    switch (_icon) {
    case BS_DISPLAY_ICON_HEART:
        display_draw(heart, _color, _background);
        break;
    case BS_DISPLAY_ICON_SMALL_HEART:
        display_draw(small_heart, _color, _background);
        break;
    case BS_DISPLAY_ICON_HAPPY_FACE:
        display_draw(happy_face, _color, _background);
        break;
    case BS_DISPLAY_ICON_SAD_FACE:
        display_draw(sad_face, _color, _background);
        break;
    default:
        break;
    }
  }
  DELETE_ROOT_SET(func_rootset)
}

// show string
void mth_3_000002Display(value_t self, value_t _str, int32_t _color, int32_t _background) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _str;
  {
    char* text = gc_string_to_cstr(_str);
    display_text(text, (uint16_t)_color, (uint16_t)_background);
  }
  DELETE_ROOT_SET(func_rootset)
}

// show int
void mth_4_000002Display(value_t self, int32_t _int, int32_t _color, int32_t _background) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    char buff[12]; // Max num length + blank
    sprintf(buff, "%ld", _int);
    display_text(&buff, (uint16_t)_color, (uint16_t)_background);
  }
  DELETE_ROOT_SET(func_rootset)
}

// color
int32_t mth_5_000002Display(value_t self, int32_t _r, int32_t _g, int32_t _b) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    int32_t _color = 0;
    _color |= ((_r >> 3) << 11);
    _color |= ((_g >> 2) << 5);
    _color |= ((_b >> 3) << 0);
    _color = (_color >> 8) | (_color << 8); // big-endian
    { int32_t ret_value_ = (_color); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void bluescript_main0_000002() {
  ROOT_SET_INIT(global_rootset0_000002, 0)
  
  
}
