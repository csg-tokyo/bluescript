import axios from "axios";

export type CompileResult = {
    values: {
        text: string,
        literal: string,
        data: string,
        rodata: string,
        bss: string
    }
    execFuncOffsets: number[]
}

export default async function replCompile(tsString:string, isFirst:boolean) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': "*"
    }
    const response =  await axios.post("http://localhost:8080/repl-compile", {tsString, isFirst}, {headers});
    const resultJson:CompileResult = JSON.parse(response.data);
    console.log(resultJson)
    return resultJson;
}