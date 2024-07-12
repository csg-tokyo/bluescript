export function translateExe(str: string): string {
  const lines: string[] = str.split('\n');
  let result = "";
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine !== "" && trimmedLine[0] !== "#" && trimmedLine[0] !== "<") {
      result += trimmedLine.split(": ")[1];
    }
  }
  return result;
}

