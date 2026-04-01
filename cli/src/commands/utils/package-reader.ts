import { ProjectConfigHandler, PROJECT_PATHS } from "../../config/project-config";
import { cwd } from "../../core/shell";
import * as path from 'path';


export function esp32PackageReader(packageName: string) {
    const mainRoot = cwd();
    const subPackageRoot = path.join(PROJECT_PATHS.PACKAGES_DIR(mainRoot), packageName);
    const root = packageName === 'main' ? mainRoot : subPackageRoot;
    try {
        const projectConfigHandler = ProjectConfigHandler.load(root).asBoard('esp32');
        return {
            name: packageName,
            espIdfComponents: projectConfigHandler.espIdfComponents,
            dependencies: Object.keys(projectConfigHandler.dependencies),
            dirs: {
                root,
                dist: PROJECT_PATHS.DIST_DIR(root),
                build: PROJECT_PATHS.BUILD_DIR(root),
                packages: PROJECT_PATHS.PACKAGES_DIR(root)
            }
        }
    } catch (error) {
        throw new Error(`Faild to read ${packageName}.`, { cause: error });
    }
}