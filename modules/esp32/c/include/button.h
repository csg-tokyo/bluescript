#ifndef __BS_BUTTON__
#define __BS_BUTTON__

#include "c-runtime.h"
#include "section.h"

void MD_SECTION_TEXT fbody_buttonOnPressed(value_t self, int32_t _buttonPin, value_t _callback);
extern MD_SECTION_DATA struct func_body _buttonOnPressed;

#endif /* __BS_BUTTON__ */
