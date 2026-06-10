import { Package } from "../project";


export default function generateMakefile(
    compilerToolchainDir: string,
    pkg: Package,
    includeDirs: string[],
    targetFilePath: string,
) {
    return `
# === Basic settings ===
TOOLCHAIN_PREFIX := ${compilerToolchainDir}/xtensa-esp32-elf-
CC := $(TOOLCHAIN_PREFIX)gcc
AR := $(TOOLCHAIN_PREFIX)ar

# === Directory settings ===
SRC_DIR := ${pkg.resolvedSourceDir}
DIST_DIR  := ${pkg.resolvedDistDir}
BUILD_DIR := ${pkg.resolvedBuildDir}
PACKAGES_DIR := ${pkg.resolvedPackageDir}

TARGET := ${targetFilePath}

# === Check for illegal file name prefixes ===
ILLEGAL_PREFIX_FILES := $(shell find $(SRC_DIR) -path $(DIST_DIR) -prune -o -path $(PACKAGES_DIR) -prune -o -type f -name "bs_*.c" -print)
ifneq ($(ILLEGAL_PREFIX_FILES),)
  $(error ERROR: You cannot use 'bs_' prefix for C source file names. Please remove or rename the following files: \\
         $(ILLEGAL_PREFIX_FILES))
endif

# === Source and object file settings ===
ORIG_SOURCES := $(shell find $(SRC_DIR) -path $(DIST_DIR) -prune -o -path $(PACKAGES_DIR) -prune -o -type f -name "*.c" -print)
DIST_SOURCES := $(foreach src,$(ORIG_SOURCES), \\
    $(subst $(SRC_DIR),$(DIST_DIR), $(src)) \\
)
DIST_SOURCES += $(shell find $(DIST_DIR) -path $(BUILD_DIR) -prune -o -type f -name "bs_*.c" -print)
OBJECTS := $(patsubst $(DIST_DIR)/%.c, $(BUILD_DIR)/%.o, $(DIST_SOURCES))

# === Compilation settings ===
INCLUDES := ${includeDirs.map(path => `-I ${path}`).join(' ')}
CFLAGS := $(INCLUDES) -O2 -w -fno-common -ffunction-sections -fdata-sections -mtext-section-literals -mlongcalls -fno-zero-initialized-in-bss


# ====================================================================
.PHONY: all

all: $(TARGET)

# Copy rules
# --------------------------------------------------------

define COPY_RULE_TEMPLATE
$(1): $(2)
\t@echo "Copying $$< to $$@"
\t@mkdir -p $$(dir $$@)
\t@cp $$< $$@
endef

$(foreach src,$(ORIG_SOURCES), \\
    $(eval $(call COPY_RULE_TEMPLATE, \\
        $(subst $(SRC_DIR),$(DIST_DIR), $(src)), \\
        $(src) \\
    )) \\
)


# Build rules
# --------------------------------------------------------

$(TARGET): $(OBJECTS)
\t@echo "Archiving library: $@"
\t@mkdir -p $(@D)
\t$(AR) rcs $@ $^

vpath %.c $(DIST_DIR)

$(BUILD_DIR)/%.o: $(DIST_DIR)/%.c
\t@echo "Compiling: $< -> $@"
\t@mkdir -p $(@D)
\t$(CC) $(CFLAGS) -c $< -o $@


.PHONY: clean
clean:
\t@echo "Cleaning dist directory..."
\t@rm -rf $(DIST_DIR)  
`;
}