// Copyright (C) 2024- Shigeru Chiba.  All rights reserved.

// builtin functions for the shell.  No toplevel statements are allowed.

export type integer = number;
export type float = number;
export function code(strings: any, ... keys: any[]) {}

code`
#include <stdio.h>
#include <time.h>

// builtin functions

static void print_value(value_t m) {
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
          print_value(gc_safe_array_get(m, i));
        }
        if (n > 10)
          printf(", ... (len=%d)", n);

        putchar(']');
      }
    }
  }
}
`

export function print(v: any) {
  code`print_value(${v})`
  code`putchar('\n')`
}

export function print_i32(i: integer) {
  code`printf("%d\n", ${i})`
}

// in msec.
export function performance_now(): integer {
  let t: integer = 0
  code`
  static struct timespec ts0 = { 0, -1 };
  struct timespec ts;
  if (ts0.tv_nsec < 0)
    clock_gettime(CLOCK_REALTIME, &ts0);

  clock_gettime(CLOCK_REALTIME, &ts);
  ${t} = (int32_t)((ts.tv_sec - ts0.tv_sec) * 1000 + (ts.tv_nsec - ts0.tv_nsec) / 1000000);
  `
  return t
}
