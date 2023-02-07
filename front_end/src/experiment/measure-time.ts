import replCompile from "../services/repl-compile";

export async function measureServerTime(codeStr: string) {
  for (let i = 0; i < 10; i++) { // warm up
    await replCompile(codeStr, false);
  }
  const times: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await replCompile(codeStr, false);
    const end = performance.now();
    times.push(end - start);
  }
  console.log("average:", timeAverage(times));
}

// export async function measureAllFlowTime(codeStr: string, bluetooth: Bluetooth) {
//   for (let i = 0; i < 5; i++) { // warm up
//     const {text, data, mainFuncOffset} = await compile(codeStr);
//     // await bluetooth.sendMachineCode(text, data, mainFuncOffset);
//     sleep(3000);
//     console.log(i);
//   }
//   console.log("Warm up end.")
//   const times: number[] = [];
//   for (let i = 0; i < 10; i++) {
//     const start = performance.now();
//     const {text, data, mainFuncOffset} = await compile(codeStr);
//     // await bluetooth.sendMachineCode(text, data, mainFuncOffset);
//     const end = performance.now();
//     times.push(end - start);
//     sleep(3000);
//     console.log(i);
//   }
//   console.log("average:", timeAverage(times));
// }

function sleep(waitMS: number) {
  let startMS = Date.now();
  while ((Date.now() - startMS) < waitMS);
}


function timeAverage(times: number[]):number {
  const sum = times.reduce((a, b) => a + b);
  return sum / times.length;
}