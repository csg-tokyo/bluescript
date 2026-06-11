import { Package } from "../project";


type BaseMakefileConfig = {
    pkg: Package,
    includeDirs: string[],
    compileFlags: string[],
}

type ArchiveMakefileConfig = BaseMakefileConfig & {
    output: { kind: 'archive', path: string },
    toolchain: { cc: string; ar: string }
}

type SharedMakefileConfig = BaseMakefileConfig & {
    output: { kind: 'shared', path: string, libs: string[] },
    toolchain: { cc: string }
};

type MakefileConfig = ArchiveMakefileConfig | SharedMakefileConfig;

export function esp32MakefilePreset(toolchainDir: string, pkg: Package, includeDirs: string[], archivePath: string): ArchiveMakefileConfig {
    return {
        pkg, includeDirs,
        compileFlags: [
            '-O2', '-w', '-fno-common',
            '-ffunction-sections', '-fdata-sections',
            '-mtext-section-literals', '-mlongcalls',
            '-fno-zero-initialized-in-bss',
        ],
        output: { kind: 'archive', path: archivePath },
        toolchain: {
            cc: `${toolchainDir}/xtensa-esp32-elf-gcc`,
            ar: `${toolchainDir}/xtensa-esp32-elf-ar`
        }
    }
}

export function hostMakefilePreset(pkg: Package, includeDirs: string[], soPath: string, libs: string[]): SharedMakefileConfig {
    return {
        pkg, includeDirs,
        compileFlags: ['-O2', '-w', '-fPIC', '-DLINUX64'],
        output: { kind: 'shared', path: soPath, libs },
        toolchain: { cc: `cc` }
    }
}

export function generateMakefile2(config: MakefileConfig): string {
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

function isArchiveConfig(config: MakefileConfig): config is ArchiveMakefileConfig {
    return config.output.kind === 'archive';
}

function renderHeader(config: MakefileConfig): string {
    const { pkg } = config;
    const basicSettings = isArchiveConfig(config)
        ? renderArchiveToolchain(config.toolchain)
        : renderSharedToolchain(config.toolchain);

    return `# === Basic settings ===
${basicSettings}

# === Directory settings ===
SRC_DIR := ${pkg.resolvedSourceDir}
DIST_DIR  := ${pkg.resolvedDistDir}
BUILD_DIR := ${pkg.resolvedBuildDir}
PACKAGES_DIR := ${pkg.resolvedPackageDir}

TARGET := ${config.output.path}`;
}

function renderArchiveToolchain(toolchain: ArchiveMakefileConfig['toolchain']): string {
    return `CC := ${toolchain.cc}
AR := ${toolchain.ar}`;
}

function renderSharedToolchain(toolchain: SharedMakefileConfig['toolchain']): string {
    return `CC := ${toolchain.cc}`;
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
DIST_SOURCES := $(foreach src,$(ORIG_SOURCES), \\
    $(subst $(SRC_DIR),$(DIST_DIR), $(src)) \\
)
DIST_SOURCES += $(shell find $(DIST_DIR) -path $(BUILD_DIR) -prune -o -type f -name "bs_*.c" -print)
OBJECTS := $(patsubst $(DIST_DIR)/%.c, $(BUILD_DIR)/%.o, $(DIST_SOURCES))`;
}

function renderCompileFlags(config: MakefileConfig): string {
    const includes = config.includeDirs.map(path => `-I ${path}`).join(' ');
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
)`;
}

function renderBuildRules(config: MakefileConfig): string {
    return `# Build rules
# --------------------------------------------------------

${renderAggregationRule(config)}

vpath %.c $(DIST_DIR)

$(BUILD_DIR)/%.o: $(DIST_DIR)/%.c
\t@echo "Compiling: $< -> $@"
\t@mkdir -p $(@D)
\t$(CC) $(CFLAGS) -c $< -o $@`;
}

function renderAggregationRule(config: MakefileConfig): string {
    switch (config.output.kind) {
        case 'archive':
            return `$(TARGET): $(OBJECTS)
\t@echo "Archiving library: $@"
\t@mkdir -p $(@D)
\t$(AR) rcs $@ $^`;
        case 'shared':
            return `$(TARGET): $(OBJECTS)
\t@echo "Linking shared library: $@"
\t@mkdir -p $(@D)
\t$(CC) -shared -o $@ $^ ${config.output.libs.join(' ')}`;
    }
}

function renderClean(_config: MakefileConfig): string {
    return `.PHONY: clean
clean:
\t@echo "Cleaning dist directory..."
\t@rm -rf $(DIST_DIR)`;
}
