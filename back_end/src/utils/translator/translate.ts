import * as babelParser from "@babel/parser";
import BlockEnv from "./env";
import generateCString from "./generate-c-string";

export default function translate(tsString: string, env: BlockEnv): string {
  const node = babelParser.parse(tsString, {plugins: ["typescript"]});
  return generateCString(node, env);
}