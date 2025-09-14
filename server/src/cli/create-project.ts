import { BSCRIPT_ENTRY_FILE_NAME, BSCRIPT_CONFIG_FILE_NAME } from "./constants";
import { logger, createDirectory, directoryExists } from "./utils";
import * as fs from 'fs';

const BS_TEMPLATE = `print("Hello world!");\n`;
const BS_SETTINGS = (projectName: string) => `
{
    "name": "${projectName}",
    "device": {
        "kind": "esp32",
        "name": "BLUESCRIPT"
    }
}

`

export default function createProject(name: string) {
    const dirPath = `./${name}`;
    try {
        if (directoryExists(dirPath)) {
            logger.info("A project with the specified name already exists.");
            return;
        }
        createDirectory(dirPath, true);
        fs.writeFileSync(`${dirPath}/${BSCRIPT_ENTRY_FILE_NAME}`, BS_TEMPLATE);
        fs.writeFileSync(`${dirPath}/${BSCRIPT_CONFIG_FILE_NAME}`, BS_SETTINGS(name));
        logger.success("Successfully created a new project.");
    } catch (error) {
        logger.error("Failed to create a new project.");
        process.exit(1);
    }
}
