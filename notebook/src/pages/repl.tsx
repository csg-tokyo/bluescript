import {useState} from 'react';
import {CSSProperties} from 'react';
import {Button} from '@mui/material';
import {ButtonGroup} from "@mui/material";

import Bluetooth, {CHARACTERISTIC_IDS} from '../services/bluetooth';
import * as network from "../services/network"
import BSCodeEditorCell from "../components/code-editor-cell";
import BSCodeEditorCellDisabled from "../components/code-editor-cell-disabled";
import {Buffer} from "buffer";
import Grid2 from "@mui/material/Unstable_Grid2";
import BSLogArea from "../components/log-area";
import { CompileError } from '../utils/error';


const bluetooth = new Bluetooth();

export default function Repl() {
  const [code, setCode] = useState("function main(n: number):number {\n  return 2;\n}");
  const [exitedCodes, setExitedCodes] = useState<string[]>([]);
  const [log, setLog] = useState("");
  const [compileError, setCompileError] = useState("");
  let logString = "";

  const exitCode = async () => {
    console.log("execute pushed", performance.now())
    setCompileError("");
    try {
      const {exe} = await network.replCompile(code);
      console.log(exe);
      await bluetooth.sendMachineCode(CHARACTERISTIC_IDS.REPL, exe);
      setExitedCodes([...exitedCodes, code]);
      setCode("");
    } catch (error: any) {
      if (error instanceof CompileError) {
        setCompileError(error.toString());
      } else {
        console.log(error);
        window.alert(`Failed to compile: ${error.message}`);
      }
    }
  }

  const onClearPushed = async () => {
    try {
      await Promise.all([
        network.clear(),
        bluetooth.sendMachineCode(CHARACTERISTIC_IDS.CLEAR, "")
      ]);
      setExitedCodes([]);
      setCode("");
      setLog("");
      setCompileError("");
    } catch (error: any) {
      console.log(error);
      window.alert(`Failed to compile: ${error.message}`);
    }
  }

  const onLogSent = (event: Event) => {
    // @ts-ignore
    logString += Buffer.from(event.target.value.buffer).toString();
    // @ts-ignore
    console.log("receive log", performance.now());
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
          <div style={style.compileErrorBox}>{compileError}</div>
        </Grid2>
        <Grid2 xs={5}>
          <BSLogArea log={log} />
        </Grid2>
      </Grid2>
    </div>
  );
}


const style: { [key: string]: CSSProperties } = {
  compileErrorBox: {
    color: "red",
    paddingLeft: 10,
    whiteSpace: "pre-wrap",
    lineHeight: "150%"
  }
}