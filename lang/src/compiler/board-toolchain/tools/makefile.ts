import { PackageForEsp32, PackageForHostUnix, PackageForHostWindows } from "../../package"

type MakefileConfig = {
    outputFile: string,
    objectFiles: string[],
    headerFilesInDist: string[],
    includeDirs: string[],
    compileFlags: string[],
    distDir: string,
    buildDir: string,
    toolchain: {
        cc: string,
        ar: string
    }
}

function toMakePath(p: string) {
    return p.replace(/\\/g, '/');
};

export function esp32MakefilePreset(pkg: PackageForEsp32, includeDirs: string[], toolchain: {gcc: string, ar: string}): MakefileConfig {
    return {
        outputFile: toMakePath(pkg.archiveFile),
        objectFiles: pkg.objectFiles.map(toMakePath),
        headerFilesInDist: pkg.headerFilesInDist.map(toMakePath),
        includeDirs: [pkg.resolvedBuildDir, ...includeDirs].map(toMakePath),
        compileFlags: [
            '-O2', '-w', '-fno-common',
            '-ffunction-sections', '-fdata-sections',
            '-mtext-section-literals', '-mlongcalls',
            '-fno-zero-initialized-in-bss',
        ],
        distDir: toMakePath(pkg.resolvedDistDir),
        buildDir: toMakePath(pkg.resolvedBuildDir),
        toolchain: {
            cc: toMakePath(toolchain.gcc),
            ar: toMakePath(toolchain.ar)
        }
    }
}

export function hostUnixMakefilePrest(pkg: PackageForHostUnix, toolchain: {gcc: string, ar: string}) {
    return {
        outputFile: pkg.archiveFile,
        objectFiles: pkg.objectFiles,
        headerFilesInDist: pkg.headerFilesInDist,
        includeDirs: [pkg.resolvedDistDir],
        compileFlags: ['-O2', '-w', '-fPIC', '-DLINUX64'],
        distDir: pkg.resolvedDistDir,
        buildDir: pkg.resolvedBuildDir,
        toolchain: {
            cc: toolchain.gcc,
            ar: toolchain.ar
        }
    }
}

export function hostWindowsMakefilePreset(pkg: PackageForHostWindows, toolchain: {gcc: string, ar: string}): MakefileConfig {
    return {
        outputFile: toMakePath(pkg.archiveFile),
        objectFiles: pkg.objectFiles.map(toMakePath),
        headerFilesInDist: pkg.headerFilesInDist.map(toMakePath),
        includeDirs: [toMakePath(pkg.resolvedDistDir)],
        compileFlags: ['-O2', '-w', '-DLINUX64'],
        distDir: toMakePath(pkg.resolvedDistDir),
        buildDir: toMakePath(pkg.resolvedBuildDir),
        toolchain: {
            cc: toolchain.gcc,
            ar: toolchain.ar
        },
    };
}

export function generateMakefile(config: MakefileConfig) {
    return `

# === Variable settings ===
CC := ${config.toolchain.cc}
AR := ${config.toolchain.ar}
DIST_DIR  := ${config.distDir}
BUILD_DIR := ${config.buildDir}
TARGET := ${config.outputFile}
OBJECTS := ${config.objectFiles.join(' ')}
DIST_HEADERS := ${config.headerFilesInDist}
INCLUDES := ${config.includeDirs.map(path => `-I ${path}`).join(' ')}
CFLAGS := $(INCLUDES) ${config.compileFlags.join(' ')}


.PHONY: all
all: $(TARGET)

# Build rules
# --------------------------------------------------------

$(TARGET): $(OBJECTS) | $(DIST_HEADERS)
\t@echo "Archiving library: $@"
\t@mkdir -p "$(@D)"
\t$(AR) rcs $@ $^

vpath %.c $(DIST_DIR)

$(BUILD_DIR)/%.o: $(DIST_DIR)/%.c
\t@echo "Compiling: $< -> $@"
\t@mkdir -p "$(@D)"
\t$(CC) $(CFLAGS) -MMD -MP -c $< -o $@

-include $(wildcard $(BUILD_DIR)/*.d);

# --------------------------------------------------------

.PHONY: clean
clean:
\t@echo "Cleaning dist directory..."
\t@rm -rf $(DIST_DIR)

    `
}