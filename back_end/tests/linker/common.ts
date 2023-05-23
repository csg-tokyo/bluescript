import * as fs from "fs";


export function generateExpectedResult(casePath: string): string {
  const fileContent = fs.readFileSync(casePath).toString();
  const lines: string[] = fileContent.split('\n');
  let result = "";
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine !== "" && trimmedLine[0] !== "#" && trimmedLine[0] !== "<") {
      result += trimmedLine.split(": ")[1];
    }
  }
  return result;
}

export function generateTestCase(caseName: string): string {
  return "";
}

export function getLinkedCall8(jumpedAddress: number, call8Address: number): number {
  return (jumpedAddress - (call8Address & (-4)) - 4) * 16 + 0b100101;
}

export function getL32r(base: number, targetAddress: number, l32rAddress: number): number {
  return (targetAddress - ((l32rAddress + 3) & (-4)) << 6) + base;
}