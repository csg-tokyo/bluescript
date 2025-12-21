import * as fs from 'fs';
import { transpile } from "../transpiler/code-generator/code-generator";


function main() {
    const args: string[] = process.argv;

    if (args.length < 4) {
        console.error("Please specify input and output files.");
        process.exit(1);
    }
    const inputFile = args[2];
    const outputFile = args[3];


    const src = fs.readFileSync(inputFile, 'utf-8');
    const result = transpile(0, src);
    fs.writeFileSync(outputFile, result.code);
}


main();