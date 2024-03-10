/*
  Before compiling shell.c, comile this file and build c-runtime.so.

  cd BlueScript/server
  cc -shared -fPIC -DTEST64 -o temp-files/c-runtime.so temp-files/shell-builtins.c ../esp32/components/c-runtime/c-runtime.c
*/

#include <stdio.h>
#include <time.h>
#include "../../../esp32/components/c-runtime/c-runtime.h"

// builtin functions

static void fbody_print(value_t self, value_t m) {
  if (is_int_value(m))
    printf("%d\n", value_to_int(m));
  else if (is_float_value(m))
    printf("%f\n", value_to_float(m));
  else if (m == VALUE_NULL)
    puts("null");
  else if (gc_is_string_literal(m))
    puts(gc_string_literal_cstr(m));
  else
    puts("??");
}

static void fbody_print_i32(value_t self, int32_t i) {
  printf("%d\n", i);
}

/* in msec */
static int32_t fbody_performance_now(value_t self) {
  static struct timespec ts0 = { 0, -1 };
  struct timespec ts;
  if (ts0.tv_nsec < 0)
    clock_gettime(CLOCK_REALTIME, &ts0);

  clock_gettime(CLOCK_REALTIME, &ts);
  return (int32_t)((ts.tv_sec - ts0.tv_sec) * 1000 + (ts.tv_nsec - ts0.tv_nsec) / 1000000);
}

struct _print { void (*fptr)(value_t, value_t); const char* sig; } _print = { fbody_print, "(a)v" };
struct _print_i32 { void (*fptr)(value_t, int32_t); const char* sig; } _print_i32 = { fbody_print_i32, "(i)v" };
struct _performance_now { int32_t (*fptr)(value_t); const char* sig; } _performance_now = { fbody_performance_now, "()i" };
