
#include <stdint.h>
#include "c-runtime.h"
#include "display-helper.h"
static void cons_000002Display(value_t self);
value_t new_000002Display(value_t self);
void mth_0_000002Display(value_t self, int32_t _color);
void mth_1_000002Display(value_t self, int32_t _icon, int32_t _color, int32_t _background);
void mth_2_000002Display(value_t self, value_t _str, int32_t _color, int32_t _background);
void mth_3_000002Display(value_t self, int32_t _int, int32_t _color, int32_t _background);
int32_t mth_4_000002Display(value_t self, int32_t _r, int32_t _g, int32_t _b);
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_000002();
ROOT_SET_DECL(global_rootset0_000002, 0);
static const uint16_t mnames_000002Display[] = { 12, 13, 14, 15, 16, };
static const char* const msigs_000002Display[] = { "(i)v", "(iii)v", "(sii)v", "(iii)v", "(iii)i", };
static const uint16_t plist_000002Display[] = { 8, 9, 10, 11 };
CLASS_OBJECT(class_000002Display, 5) = {
    .body = { .s = 4, .i = 4, .cn = "000002Display", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 4, .offset = 0,
    .unboxed = 4, .prop_names = plist_000002Display, .unboxed_types = "iiii" }, .mt = { .size = 5, .names = mnames_000002Display, .signatures = msigs_000002Display }, .vtbl = { mth_0_000002Display, mth_1_000002Display, mth_2_000002Display, mth_3_000002Display, mth_4_000002Display,  }}};

static void cons_000002Display(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    *get_obj_int_property(self, 0) = 0;
    *get_obj_int_property(self, 1) = 1;
    *get_obj_int_property(self, 2) = 2;
    *get_obj_int_property(self, 3) = 3;
    display_init();
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_000002Display(value_t self) { cons_000002Display(self); return self; }


void mth_0_000002Display(value_t self, int32_t _color) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    display_fill(_color);
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_1_000002Display(value_t self, int32_t _icon, int32_t _color, int32_t _background) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    if (_icon == *get_obj_int_property(self, 0)) 
      display_show_heart_icon(_color, _background);
    else 
      if (_icon == *get_obj_int_property(self, 1)) 
        display_show_small_heart_icon(_color, _background);
      else 
        if (_icon == *get_obj_int_property(self, 2)) 
          display_show_happy_face_icon(_color, _background);
        else 
          if (_icon == *get_obj_int_property(self, 3)) 
          display_show_sad_face_icon(_color, _background);
          else 
          runtime_error("** display module error: unknown icon.");
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_2_000002Display(value_t self, value_t _str, int32_t _color, int32_t _background) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _str;
  {
    char* text = gc_string_to_cstr(_str);
    display_show_string(text, _color, _background);
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_3_000002Display(value_t self, int32_t _int, int32_t _color, int32_t _background) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    display_show_integer(_int, _color, _background);
  }
  DELETE_ROOT_SET(func_rootset)
}

int32_t mth_4_000002Display(value_t self, int32_t _r, int32_t _g, int32_t _b) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    int32_t _color = 0;
    _color = display_color(_r, _g, _b);
    { int32_t ret_value_ = (_color); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void bluescript_main0_000002() {
  ROOT_SET_INIT(global_rootset0_000002, 0)
  
  ;
  
}
