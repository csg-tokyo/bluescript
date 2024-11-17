#include <string.h>
#include <stdio.h>
#include <stdlib.h>

#include "../include/profiler.h"
#include "../include/c-runtime.h"


#define BS_PROFILER_TAG        "BS_PROFILER"

#define TYPEINT_SIZE             sizeof(typeint_t)
#define PARAMS_NUM               4
#define TYPE_PROFILE_COLUMN      (PARAMS_NUM + 1)
#define TYPE_PROFILE_ROW         5
#define TYPE_PROFILE_SIZE        TYPEINT_SIZE * TYPE_PROFILE_COLUMN * TYPE_PROFILE_ROW
#define TYPE_COUNT_THRESHOLD     5
#define CALL_COUNT_THRESHOLD     5

char types_str[128];

static typeint_t value_to_typeint(value_t p) {
    uint32_t last_2bit = p & 3;
	if (last_2bit == 3 && p != VALUE_UNDEF) {
        class_object* obj_class = gc_get_class_of(p);
        return obj_class == NULL ? VALUE_UNDEF : (typeint_t)obj_class;
	} else {
		return last_2bit;
	}
}

static const char* typeint_to_str(typeint_t typeint) {
    if (typeint == 0b00) {
		return "integer";
	} else if (typeint == 0b01) {
		return "float";
	} else if (typeint == 0b10) {
		return "boolean";
	} else if (typeint == 0b11) {
		return "undefined";
	} else {
        return ((class_object*)typeint)->name;
	}
}

static inline bool row_is_empty(typeint_t* type_profile_row) {
    return *type_profile_row == 0;
}

static inline void increment_row_count(typeint_t* type_profile_row) {
    *type_profile_row += 1;   
}

static void set_initial_row(typeint_t* type_profile_row, value_t p1, value_t p2, value_t p3, value_t p4) {
    *type_profile_row = 1;
    *(type_profile_row + 1) = value_to_typeint(p1);
    *(type_profile_row + 2) = value_to_typeint(p2);
    *(type_profile_row + 3) = value_to_typeint(p3);
    *(type_profile_row + 4) = value_to_typeint(p4);
}

static bool row_match_param_types(typeint_t* type_profile_row, value_t p1, value_t p2, value_t p3, value_t p4) {
    bool p1_match = value_to_typeint(p1) == *(type_profile_row + 1);
    bool p2_match = value_to_typeint(p2) == *(type_profile_row + 2);
    bool p3_match = value_to_typeint(p3) == *(type_profile_row + 3);
    bool p4_match = value_to_typeint(p4) == *(type_profile_row + 4);
    return p1_match && p2_match && p3_match && p4_match;
}

static char* row_to_str(typeint_t* type_profile_row) {
    const char* p1_str = typeint_to_str(*(type_profile_row + 1));
    const char* p2_str = typeint_to_str(*(type_profile_row + 2));
    const char* p3_str = typeint_to_str(*(type_profile_row + 3));
    const char* p4_str = typeint_to_str(*(type_profile_row + 4));
    snprintf(types_str, sizeof(types_str), "%s, %s, %s, %s", p1_str, p2_str, p3_str, p4_str);
    return types_str;
}

static void send_row(uint8_t fid, typeint_t* type_profile_row) {
    char* s = row_to_str(type_profile_row);
#ifdef TEST64
    printf("%s\n", s);
#else 
    bs_logger_push_profile(fid, s);
#endif
}

static typeint_t* get_row_on_threshold(uint8_t fid, typeint_t* type_profile, value_t p1, value_t p2, value_t p3, value_t p4) {
    for (int i = 0; i < TYPE_PROFILE_ROW; i++) {
        typeint_t* row = type_profile + TYPE_PROFILE_COLUMN * i;
        if(row_is_empty(row)) {
            set_initial_row(row, p1, p2, p3, p4);
            return NULL;
        } else if (row_match_param_types(row, p1, p2, p3, p4)) {
            increment_row_count(row);
            return *row == TYPE_COUNT_THRESHOLD ? row : NULL;
        }
    }
    return NULL;
}

void bs_profiler_profile(uint8_t fid, uint8_t* call_count, typeint_t** type_profile, value_t p1, value_t p2, value_t p3, value_t p4) {
    if (*call_count < CALL_COUNT_THRESHOLD) {
        *call_count += 1;
        return;
    } else if (*call_count == CALL_COUNT_THRESHOLD) {
        *call_count += 1;
        *type_profile = malloc(TYPE_PROFILE_SIZE);
		memset(*type_profile, 0, TYPE_PROFILE_SIZE);
        return;
    } else if (*type_profile) {
        typeint_t* result_row = get_row_on_threshold(fid, *type_profile, p1, p2, p3, p4);
        if (result_row != NULL) {
            send_row(fid, result_row);
            free(*type_profile);
            *type_profile = NULL;
        }
        return;
    }
    return;
}

