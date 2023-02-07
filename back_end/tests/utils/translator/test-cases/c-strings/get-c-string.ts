import * as fs from "fs";


export default function getCString(dirName: string, fileName: string): string {
  const path = `./tests/utils/translator/test-cases/c-strings/${dirName}/${fileName}`
  return fs.readFileSync(path).toString();
}