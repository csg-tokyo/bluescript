
#include "c-runtime.h"
#include "utils.c"

void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 1)

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 1)
  ROOT_SET(func_rootset, 0)
  global_rootset2.values[0] = gc_make_array(3, int_to_value(1), int_to_value(3), int_to_value(4));
  (*gc_array_get(global_rootset2.values[0], 2)) = int_to_value(3);
  DELETE_ROOT_SET(func_rootset)
}
