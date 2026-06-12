import { Package } from "../../project";


type MakefileConfig = {
    pkg: Package,
    includeDirs: string[],
    compileFlags: string[],
    outputFile: string,
    toolchain: { cc: string; ar: string }
}


export function esp32MakefilePreset(toolchainDir: string, pkg: Package, includeDirs: string[], outputFile: string): MakefileConfig {
    return {
        pkg, includeDirs,
        compileFlags: [
            '-O2', '-w', '-fno-common',
            '-ffunction-sections', '-fdata-sections',
            '-mtext-section-literals', '-mlongcalls',
            '-fno-zero-initialized-in-bss',
        ],
        outputFile,
        toolchain: {
            cc: `${toolchainDir}/xtensa-esp32-elf-gcc`,
            ar: `${toolchainDir}/xtensa-esp32-elf-ar`
        }
    }
}

export function hostMakefilePreset(pkg: Package, outputFile: string): MakefileConfig {
    return {
        pkg, 
        includeDirs: [],
        compileFlags: ['-O2', '-w', '-fPIC', '-DLINUX64'],
        outputFile,
        toolchain: {
            cc: `cc`,
            ar: `ar`
        }
    }
}

export function generateMakefile(config: MakefileConfig): string {
    return [
        // preamble
        renderHeader(config),
        renderValidation(config),
        renderSourceVars(config),
        renderCompileFlags(config),

        // body
        renderPhonyAll(config),
        renderCopyRules(config),
        renderBuildRules(config),
        renderClean(config)
    ].join('\n\n');
}

function renderHeader(config: MakefileConfig): string {
    const { pkg } = config;
    return `# === Basic settings ===
CC := ${config.toolchain.cc}
AR := ${config.toolchain.ar}

# === Directory settings ===
SRC_DIR := ${pkg.resolvedSourceDir}
DIST_DIR  := ${pkg.resolvedDistDir}
BUILD_DIR := ${pkg.resolvedBuildDir}
PACKAGES_DIR := ${pkg.resolvedPackageDir}

TARGET := ${config.outputFile}`;
}

function renderValidation(_config: MakefileConfig): string {
    return `# === Check for illegal file name prefixes ===
ILLEGAL_PREFIX_FILES := $(shell find $(SRC_DIR) -path $(DIST_DIR) -prune -o -path $(PACKAGES_DIR) -prune -o -type f -name "bs_*.c" -print)
ifneq ($(ILLEGAL_PREFIX_FILES),)
  $(error ERROR: You cannot use 'bs_' prefix for C source file names. Please remove or rename the following files: \\
         $(ILLEGAL_PREFIX_FILES))
endif`;
}

function renderSourceVars(_config: MakefileConfig): string {
    return `# === Source and object file settings ===
ORIG_SOURCES := $(shell find $(SRC_DIR) -path $(DIST_DIR) -prune -o -path $(PACKAGES_DIR) -prune -o -type f -name "*.c" -print)
ORIG_HEADERS := $(shell find $(SRC_DIR) -path $(DIST_DIR) -prune -o -path $(PACKAGES_DIR) -prune -o -type f -name "*.h" -print)
DIST_SOURCES := $(foreach src,$(ORIG_SOURCES), \\
    $(subst $(SRC_DIR),$(DIST_DIR), $(src)) \\
)
DIST_HEADERS := $(foreach hdr,$(ORIG_HEADERS), \\
    $(subst $(SRC_DIR),$(DIST_DIR), $(hdr)) \\
)
DIST_SOURCES += $(shell find $(DIST_DIR) -path $(BUILD_DIR) -prune -o -type f -name "bs_*.c" -print)
OBJECTS := $(patsubst $(DIST_DIR)/%.c, $(BUILD_DIR)/%.o, $(DIST_SOURCES))`;
}

function renderCompileFlags(config: MakefileConfig): string {
    const extraIncludes = config.includeDirs.map(path => `-I ${path}`).join(' ');
    const includes = extraIncludes
        ? `-I $(DIST_DIR) -I $(SRC_DIR) ${extraIncludes}`
        : `-I $(DIST_DIR) -I $(SRC_DIR)`;
    return `# === Compilation settings ===
INCLUDES := ${includes}
CFLAGS := $(INCLUDES) ${config.compileFlags.join(' ')}`;
}

function renderPhonyAll(_config: MakefileConfig): string {
    return `# ====================================================================
.PHONY: all

all: $(TARGET)`;
}

function renderCopyRules(_config: MakefileConfig): string {
    return `# Copy rules
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

$(foreach hdr,$(ORIG_HEADERS), \\
    $(eval $(call COPY_RULE_TEMPLATE, \\
        $(subst $(SRC_DIR),$(DIST_DIR), $(hdr)), \\
        $(hdr) \\
    )) \\
)`;
}

function renderBuildRules(_config: MakefileConfig): string {
    return `# Build rules
# --------------------------------------------------------

$(TARGET): $(OBJECTS) | $(DIST_HEADERS)
\t@echo "Archiving library: $@"
\t@mkdir -p $(@D)
\t$(AR) rcs $@ $^

vpath %.c $(DIST_DIR)

$(BUILD_DIR)/%.o: $(DIST_DIR)/%.c
\t@echo "Compiling: $< -> $@"
\t@mkdir -p $(@D)
\t$(CC) $(CFLAGS) -MMD -MP -c $< -o $@

-include $(wildcard $(BUILD_DIR)/*.d)`;
}

function renderClean(_config: MakefileConfig): string {
    return `.PHONY: clean
clean:
\t@echo "Cleaning dist directory..."
\t@rm -rf $(DIST_DIR)`;
}
