
#include <string.h>
#include <stdio.h>
#include <time.h>
#include "../../core/include/c-runtime.h"


void print_message(value_t m) {
    if (is_int_value(m))
        printf("%d", value_to_int(m));
    else if (is_float_value(m))
        printf("%f", value_to_float(m));
    else if (m == VALUE_NULL || m == VALUE_UNDEF)
        printf("undefined");
    else if (m == VALUE_TRUE)
        printf("true");
    else if (m == VALUE_FALSE)
        printf("false");
    else if (gc_is_string_object(m))
        printf("'%s'", gc_string_to_cstr(m));
    else {
        class_object* cls = gc_get_class_of(m);
        if (cls == NULL)
            printf("??");
        else {
            printf("<class %s>", cls->name);
            int32_t n = get_all_array_length(m);
            if (n >= 0) {
                putchar('[');
                for (int32_t i = 0; i < n && i < 10; i++) {
                    if (i > 0)
                        printf(", ");
                    print_message(gc_safe_array_get(m, i));
                }
                if (n > 10)
                    printf(", ... (len=%d)", n);

                putchar(']');
            }
        }
    }
}


extern struct func_body _print;
void mth_0_Console(value_t self, value_t _message);
void mth_1_Console(value_t self, value_t _message);
float mth_0_Time(value_t self);
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_();
ROOT_SET_DECL(global_rootset0, 2);
static const uint16_t mnames_Console[] = { 8, 9, };
static const char* const msigs_Console[] = { "(a)v", "(a)v", };
static const uint16_t plist_Console[] = {  };
CLASS_OBJECT(class_Console, 2) = {
    .body = { .s = 0, .i = 0, .cn = "Console", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 0, .offset = 0,
    .unboxed = 0, .prop_names = plist_Console, .unboxed_types = "" }, .mt = { .size = 2, .names = mnames_Console, .signatures = msigs_Console }, .vtbl = { mth_0_Console, mth_1_Console,  }}};
static const uint16_t mnames_Time[] = { 10, };
static const char* const msigs_Time[] = { "()f", };
static const uint16_t plist_Time[] = {  };
CLASS_OBJECT(class_Time, 1) = {
    .body = { .s = 0, .i = 0, .cn = "Time", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 0, .offset = 0,
    .unboxed = 0, .prop_names = plist_Time, .unboxed_types = "" }, .mt = { .size = 1, .names = mnames_Time, .signatures = msigs_Time }, .vtbl = { mth_0_Time,  }}};

static void fbody_print(value_t self, value_t _message) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _message;
  {
    print_message(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _print = { fbody_print, "(a)v" };

void mth_0_Console(value_t self, value_t _message) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _message;
  {
    print_message(func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_1_Console(value_t self, value_t _message) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _message;
  {
    print_message(func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_Console(value_t self) { return self; }


float mth_0_Time(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    int32_t _t = 0;
    
        static struct timespec ts0 = { 0, -1 };
        struct timespec ts;
        if (ts0.tv_nsec < 0)
            clock_gettime(CLOCK_REALTIME, &ts0);

        clock_gettime(CLOCK_REALTIME, &ts);
        _t = (int32_t)((ts.tv_sec - ts0.tv_sec) * 1000 + (ts.tv_nsec - ts0.tv_nsec) / 1000000);
        ;
    { float ret_value_ = (_t); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

value_t new_Time(value_t self) { return self; }


void bluescript_main0_() {
  ROOT_SET_INIT(global_rootset0, 2)
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  ;
  set_global_variable(&global_rootset0.values[0], new_Console(func_rootset.values[0]=gc_new_object(&class_Console.clazz)));
  set_global_variable(&global_rootset0.values[1], new_Time(func_rootset.values[0]=gc_new_object(&class_Time.clazz)));
  DELETE_ROOT_SET(func_rootset)
}
