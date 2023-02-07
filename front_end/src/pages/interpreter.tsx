import {useState} from 'react';
import {Button} from '@mui/material';
import {ButtonGroup} from "@mui/material";

import Bluetooth from '../services/bluetooth';
import replCompile from '../services/repl-compile';
import BSCodeEditorCell from "../components/code-editor-cell";
import BSCodeEditorCellDisabled from "../components/code-editor-cell-disabled";
import replClear from "../services/repl-clear";
import {Buffer} from "buffer";
import Grid2 from "@mui/material/Unstable_Grid2";
import BSLogArea from "../components/log-area";

const bluetooth = new Bluetooth(0x00ff);

export default function Interpreter() {
  const [code, setCode] = useState("function main(n: number):number {\n  return 2;\n}");
  const [exitedCodes, setExitedCodes] = useState<string[]>([]);
  const [log, setLog] = useState("");
  let logString = "";

  const exitCode = async () => {
    try {
      const {values, execFuncOffsets} = await replCompile(code, code.length === 0);
      const {text, literal, data, rodata, bss} = values;
      await bluetooth.addMachineCode(text, literal, data, rodata, bss, execFuncOffsets);
      setExitedCodes([...exitedCodes, code]);
      setCode("");
    } catch (error: any) {
      console.log(error);
      window.alert(`Failed to compile: ${error.message}`);
    }
  }

  const onClearPushed = async () => {
    try {
      await Promise.all([
        replClear(),
        bluetooth.clearMachineCode()
      ]);
      setExitedCodes([]);
      setCode("");
      setLog("");
    } catch (error: any) {
      console.log(error);
      window.alert(`Failed to compile: ${error.message}`);
    }
  }

  const onLogSent = (event: Event) => {
    // @ts-ignore
    logString += Buffer.from(event.target.value.buffer).toString();
    // @ts-ignore
    console.log(Buffer.from(event.target.value.buffer));
    setLog(logString);
  }

  return (
    <div style={{marginTop: 100, paddingLeft: 100, paddingRight: 100, paddingBottom: 100}}>
      <Grid2 container spacing={3}>
        <Grid2 style={{height: 50, textAlign: "end"}} xs={12}>
          <ButtonGroup variant="contained" color={"success"}>
            <Button onClick={onClearPushed}>Clear</Button>
            <Button onClick={() => bluetooth.startNotifications(onLogSent)}>Start</Button>
            <Button onClick={() => bluetooth.stopLogNotification()}>Stop</Button>
          </ButtonGroup>
        </Grid2>
        <Grid2 xs={7}>
          {exitedCodes.map((exitedCode, index) => {
            return <BSCodeEditorCellDisabled code={exitedCode} key={index}/>
          })}
          <BSCodeEditorCell code={code} exitCode={exitCode} setCode={setCode}/>
        </Grid2>
        <Grid2 xs={5}>
          <BSLogArea log={log} />
        </Grid2>
      </Grid2>
    </div>
  );
}