import * as fs from "fs";

type TestType = {
  name: string,
  ts:string,
  c:string
}

const DIR_PATH = "./tests/transpiler/code-generator/test-cases/"

export default function testCaseReader(fileName: string): TestType[] {
  const filePath = DIR_PATH + fileName;
  const fileContent = fs.readFileSync(filePath).toString();
  const lines: string[] = fileContent.split('\n');
  const result:TestType[] = [];
  let isTs = true;
  for (const line of lines) {
    if (line.substring(0, 3) === "---") {
      result.push({name: line.slice(4), ts: "", c: ""});
      continue
    }
    if (line === "### ts") {
      isTs = true;
      continue;
    }
    if (line === "### c") {
      isTs = false;
      continue;
    }
    if (isTs)
      result[result.length - 1].ts += `${line}\n`;
    else
      result[result.length - 1].c += `${line}\n`;
  }
  return result;
}