import { COMPILE_FLAGS_FILE, PackageForEsp32, PackageForHostUnix, PackageForHostWindows } from "../../package"

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

function dedupe(paths: string[]): string[] {
    return Array.from(new Set(paths));
}

export function esp32MakefilePreset(pkg: PackageForEsp32, includeDirs: string[], toolchain: {gcc: string, ar: string}): MakefileConfig {
    return {
        outputFile: toMakePath(pkg.archiveFile),
        objectFiles: pkg.objectFiles.map(toMakePath),
        headerFilesInDist: pkg.headerFilesInDist.map(toMakePath),
        includeDirs: dedupe([pkg.resolvedBuildDir, ...includeDirs].map(toMakePath)),
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
        compileFlags: ['-O2', '-w', '-DLINUX64', '-fno-common'],
        distDir: toMakePath(pkg.resolvedDistDir),
        buildDir: toMakePath(pkg.resolvedBuildDir),
        toolchain: {
            cc: toolchain.gcc,
            ar: toolchain.ar
        },
    };
}

// Compile flags are passed through a compiler response file instead of the
// command line. On Windows, make runs recipes through cmd.exe, which truncates
// command lines longer than 8191 characters; the ESP-IDF include list alone can
// exceed that. A response file also keeps paths containing spaces intact.
export function generateCompileFlagsFile(config: MakefileConfig) {
    return [
        ...config.includeDirs.map(dir => `-I "${dir}"`),
        ...config.compileFlags,
    ].join('\n') + '\n';
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
DIST_HEADERS := ${config.headerFilesInDist.join(' ')}
CFLAGS := "@$(DIST_DIR)/${COMPILE_FLAGS_FILE}"


.PHONY: all
all: $(TARGET)

# Build rules
# Recipes must stay portable: on Windows make runs them through cmd.exe (or a
# POSIX shell when sh.exe happens to be on PATH), so POSIX-only commands such as
# 'mkdir -p' cannot be used here. Output directories are created by the caller
# before make is invoked.
# --------------------------------------------------------

$(TARGET): $(OBJECTS) | $(DIST_HEADERS)
\t@echo Archiving library: $@
\t"$(AR)" rcs "$@" $^

vpath %.c $(DIST_DIR)

$(BUILD_DIR)/%.o: $(DIST_DIR)/%.c
\t@echo Compiling: $<
\t"$(CC)" $(CFLAGS) -MMD -MP -c "$<" -o "$@"

-include $(wildcard $(OBJECTS:.o=.d))

# --------------------------------------------------------

    `
}