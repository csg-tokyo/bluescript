import { PACKAGE_PATH } from "./path";
import { logger } from "./utils";
import * as fs from 'fs';

const BS_TEMPLATE = `print("Hello world!");\n`;
const DEFAULT_BSCONFIG = (projectName: string) => `
{
    "name": "${projectName}",
    "device": {
        "kind": "esp32",
        "name": "BLUESCRIPT"
    }
}

`

export default function createProject(name: string) {
    const rootPath = `./${name}`;
    try {
        if (fs.existsSync(rootPath)) {
            logger.info("A project with the specified name already exists.");
            return;
        }
        fs.mkdirSync(rootPath, {recursive: true});
        fs.writeFileSync(PACKAGE_PATH.ENTRY_FILE(rootPath), BS_TEMPLATE);
        fs.writeFileSync(PACKAGE_PATH.BSCONFIG_FILE(rootPath), DEFAULT_BSCONFIG(name));
        logger.success("Successfully created a new project.");
    } catch (error) {
        logger.error("Failed to create a new project.");
        process.exit(1);
    }
}
