import {useState, useEffect} from 'react';
import {Button} from '@mui/material';
import {ButtonGroup} from "@mui/material";

import Bluetooth, {MAX_MTU} from '../services/bluetooth';
import * as network from "../services/network"
import {Buffer} from "buffer";
import Grid2 from "@mui/material/Unstable_Grid2";
import BSLogArea from "../components/log-area";
import BSCodeEditorArea from '../components/code-editor-area';
import { CompileError } from '../utils/error';

const LOAD_CMD  = 0x01;
const JUMP_CMD  = 0x02;
const RESET_CMD = 0x03;

const bluetooth = new Bluetooth();

export default function Editor() {
  const [code, setCode] = useState("");
  const [log, setLog] = useState("");

  useEffect(() => {
    bluetooth.setNotificationHandler(onReceiveLog);
  },[]);

  const reset = async () => {
    const header = Buffer.from([RESET_CMD]);
    try {
      await Promise.all([
        network.reset({
          iram:{address:0, size:0},
          dram:{address:0, size:0},
          flash:{address:0, size:0},
        }),
        bluetooth.sendBuffers([header])
      ]);
    } catch (error: any) {
      window.alert(`Failed to clear: ${error.message}`);
    }
  }

  const onExecutePushed = async () => {
    // await reset();
    // setLog("");
    // try {
    //   const compileResult = await network.replCompile(code);
    //   const bleData = generateBLEBuffs(compileResult);
    //   await bluetooth.sendBuffers(bleData);
    // } catch (error: any) {
    //   if (error instanceof CompileError) {
    //     setLog(error.toString());
    //   } else {
    //     console.log(error);
    //     window.alert(`Failed to compile: ${error.message}`);
    //   }
    // }
  }

  const onClearPushed = async () => {
    await reset();
    setCode("");
    setLog("");
  }

  const onReceiveLog = (event: Event) => {
    // @ts-ignore
    const newLog = Buffer.from(event.target.value.buffer).toString();
    setLog(currentLog => currentLog + newLog);
  }

  return (
    <div style={{marginTop: 100, paddingLeft: 100, paddingRight: 100, paddingBottom: 100}}>
      <Grid2 container spacing={3}>
        <Grid2 style={{height: 50, textAlign: "end"}} xs={12}>
          <ButtonGroup variant="contained" color={"success"}>
            <Button onClick={onExecutePushed}>Execute</Button>
            <Button onClick={onClearPushed}>Clear</Button>
          </ButtonGroup>
        </Grid2>
        <Grid2 xs={7}>
            <BSCodeEditorArea code={code} setCode={setCode}/>
        </Grid2>
        <Grid2 xs={5}>
          <BSLogArea log={log}/>
        </Grid2>
      </Grid2>
    </div>
  );
}


// function generateBLEBuffs(compileResult: network.CompileResult): Buffer[] {
//   const resultBuffs:Buffer[] = [];

//   const textBuff = Buffer.from(compileResult.text, "hex");
//   const dataBuff = Buffer.from(compileResult.data, "hex");

//   let buffRemain = MAX_MTU;
//   let currentBuff = Buffer.alloc(0); // zero length buffer.

//   // text
//   let textRemain = textBuff.length;
//   let textOffset = 0;
//   let textLoadAddress = compileResult.textAddress;
//   while (true) {
//     if (9 + textRemain <= buffRemain) {
//       const header = createLoadHeader(textLoadAddress, textRemain);
//       const body = textBuff.subarray(textOffset);
//       currentBuff = Buffer.concat([currentBuff, header, body]);
//       buffRemain -= 9 + textRemain;
//       break;
//     } else if (9 + 3 <= buffRemain) { // text should be 4 byte align
//       const loadSize = (buffRemain - 9) - (buffRemain - 9) % 4;
//       const header = createLoadHeader(textLoadAddress, loadSize);
//       const body = textBuff.subarray(textOffset, textOffset+loadSize);
//       currentBuff = Buffer.concat([currentBuff, header, body]);

//       resultBuffs.push(currentBuff);
//       currentBuff = Buffer.alloc(0);
//       textRemain -= loadSize;
//       textOffset += loadSize;
//       textLoadAddress += loadSize;
//       buffRemain = MAX_MTU;
//     } else {
//       resultBuffs.push(currentBuff);
//       currentBuff = Buffer.alloc(0);
//       buffRemain = MAX_MTU;
//     }
//   }

//   // data
//   let dataRemain = dataBuff.length;
//   let dataOffset = 0;
//   let dataLoadAddress = compileResult.dataAddress;
//   while (true) {
//     if (9 + dataRemain <= buffRemain) {
//       const header = createLoadHeader(dataLoadAddress, dataRemain);
//       const body = dataBuff.subarray(dataOffset);
//       currentBuff = Buffer.concat([currentBuff, header, body]);
//       buffRemain -= 9 + dataRemain
//       break;
//     } else if (9 < buffRemain) {
//       const loadSize = buffRemain - 9;
//       const header = createLoadHeader(dataLoadAddress, loadSize);
//       const body = dataBuff.subarray(dataOffset, dataOffset+loadSize);
//       currentBuff = Buffer.concat([currentBuff, header, body]);

//       resultBuffs.push(currentBuff);
//       currentBuff = Buffer.alloc(0);
//       dataRemain -= loadSize;
//       dataOffset += loadSize;
//       dataLoadAddress += loadSize;
//       buffRemain = MAX_MTU;
//     } else {
//       resultBuffs.push(currentBuff);
//       currentBuff = Buffer.alloc(0);
//       buffRemain = MAX_MTU;
//     }
//   }

//   // entry point
//   const header = Buffer.allocUnsafe(5);
//   header.writeUIntLE(JUMP_CMD, 0, 1); // cmd
//   header.writeUIntLE(compileResult.entryPoint, 1, 4);
//   if (5 <= buffRemain) {
//     currentBuff = Buffer.concat([currentBuff, header]);
//     resultBuffs.push(currentBuff);
//   } else {
//     resultBuffs.push(currentBuff);
//     resultBuffs.push(header);
//   }
  
//   return resultBuffs;
// }

// function createLoadHeader(address: number, size: number) {
//   const header = Buffer.allocUnsafe(9);
//   header.writeUIntLE(LOAD_CMD, 0, 1); // cmd
//   header.writeUIntLE(address, 1, 4); // address
//   header.writeUIntLE(size, 5, 4); // size
//   return header;
// }
