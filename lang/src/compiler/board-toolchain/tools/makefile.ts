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

export function esp32MakefilePreset(pkg: PackageForEsp32, includeDirs: string[], toolchainDir: string): MakefileConfig {
    return {
        outputFile: pkg.archiveFile,
        objectFiles: pkg.objectFiles,
        headerFilesInDist: pkg.headerFilesInDist,
        includeDirs: [pkg.distDir, ...includeDirs],
        compileFlags: [
            '-O2', '-w', '-fno-common',
            '-ffunction-sections', '-fdata-sections',
            '-mtext-section-literals', '-mlongcalls',
            '-fno-zero-initialized-in-bss',
        ],
        distDir: pkg.resolvedDistDir,
        buildDir: pkg.resolvedBuildDir,
        toolchain: {
            cc: `${toolchainDir}/xtensa-esp32-elf-gcc`,
            ar: `${toolchainDir}/xtensa-esp32-elf-ar`
        }
    }
}

export function hostUnixMakefilePrest(pkg: PackageForHostUnix) {
    return {
        outputFile: pkg.archiveFile,
        objectFiles: pkg.objectFiles,
        headerFilesInDist: pkg.headerFilesInDist,
        includeDirs: [pkg.resolvedDistDir],
        compileFlags: ['-O2', '-w', '-fPIC', '-DLINUX64'],
        distDir: pkg.resolvedDistDir,
        buildDir: pkg.resolvedBuildDir,
        toolchain: {
            cc: `cc`,
            ar: `ar`
        }
    }
}

export function hostWindowsMakefilePreset(pkg: PackageForHostWindows, toolchainPrefix?: string): MakefileConfig {
    const toMakePath = (p: string) => p.replace(/\\/g, '/');
    return {
        outputFile: toMakePath(pkg.archiveFile),
        objectFiles: pkg.objectFiles.map(toMakePath),
        headerFilesInDist: pkg.headerFilesInDist.map(toMakePath),
        includeDirs: [toMakePath(pkg.resolvedDistDir)],
        compileFlags: ['-O2', '-w', '-DLINUX64', '-DWIN64'],
        distDir: toMakePath(pkg.resolvedDistDir),
        buildDir: toMakePath(pkg.resolvedBuildDir),
        toolchain: {
            cc: toolchainPrefix ? `${toMakePath(toolchainPrefix)}/gcc` : 'gcc',
            ar: toolchainPrefix ? `${toMakePath(toolchainPrefix)}/ar` : 'ar',
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
\t@mkdir -p $(@D)
\t$(AR) rcs $@ $^

vpath %.c $(DIST_DIR)

$(BUILD_DIR)/%.o: $(DIST_DIR)/%.c
\t@echo "Compiling: $< -> $@"
\t@mkdir -p $(@D)
\t$(CC) $(CFLAGS) -MMD -MP -c $< -o $@

-include $(wildcard $(BUILD_DIR)/*.d);

# --------------------------------------------------------

.PHONY: clean
clean:
\t@echo "Cleaning dist directory..."
\t@rm -rf $(DIST_DIR)

    `
}