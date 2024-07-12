#ifndef __BS_INIT__
#define __BS_INIT__

#include <stdint.h>

#define MD_SECTION __attribute__((section(".text.modules")))

extern void MD_SECTION bs_modules_init();

#endif /* __BS_INIT__ */

