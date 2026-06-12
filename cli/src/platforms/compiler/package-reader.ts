import * as path from 'path';
import { PackageForEsp32 } from "@bscript/lang";
import { BoardName } from "../../config/board-utils";
import { ProjectConfigHandler, PROJECT_DEFAULT_PATHS } from "../../config/project-config";

export function createEsp32PackageReader(
    boardName: BoardName,
    projectConfigHandler: ProjectConfigHandler,
): (name: string) => PackageForEsp32 {
    return (name: string) => {
        const mainRoot = projectConfigHandler.root;
        const subPackageRoot = path.join(mainRoot, PROJECT_DEFAULT_PATHS.PACKAGES_DIR, name);
        const isMain = name === projectConfigHandler.getConfig().projectName;
        const root = isMain ? mainRoot : subPackageRoot;
        try {
            const configHandler = isMain
                ? projectConfigHandler.asBoard(boardName)
                : ProjectConfigHandler.load(root).asBoard(boardName);
            return new PackageForEsp32(
                name,
                {
                    rootDir: root,
                    entry: configHandler.entryFile ?? PROJECT_DEFAULT_PATHS.ENTRY_FILE,
                    sourceDir: configHandler.srcDir ?? PROJECT_DEFAULT_PATHS.SRC_DIR,
                    distDir: PROJECT_DEFAULT_PATHS.DIST_DIR,
                    buildDir: PROJECT_DEFAULT_PATHS.BUILD_DIR,
                    packageDir: PROJECT_DEFAULT_PATHS.PACKAGES_DIR,
                },
                Object.keys(configHandler.dependencies),
                configHandler.espIdfComponents,
            );
        } catch (error) {
            throw new Error(`Failed to read ${name}.`, { cause: error });
        }
    };
}
