#ifndef __HARDWARELIB_H__
#define __HARDWARELIB_H__

#include <stdio.h>
#include <stdarg.h>
#include <setjmp.h>
#include <string.h>
#include "hardwarelib.h"
#include "bluescript-log.h"
#include "c-runtime.h"

#define HL_ATTR __attribute__((section(".hardwarelib")))

extern struct func_body HL_ATTR _console_log_integer;

// This function should be called so that .hardwarelib won't be deleted by linker.
void init_hardwarelib();

#endif // __HARDWARELIB_H__