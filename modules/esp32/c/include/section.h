#ifndef __BS_MD_SECTION__
#define __BS_MD_SECTION__

#include <stdint.h>

#define MD_SECTION_TEXT __attribute__((section(".modules_text")))
#define MD_SECTION_DATA __attribute__((section(".modules_data")))

#endif /* __BS_MD_SECTION__ */

