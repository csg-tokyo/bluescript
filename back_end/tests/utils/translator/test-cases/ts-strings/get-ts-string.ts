import * as fs from "fs";


export default function getTSString(dirName: string, fileName: string):string {
  const path = `./tests/utils/translator/test-cases/ts-strings/${dirName}/${fileName}`
  return fs.readFileSync(path).toString();
}