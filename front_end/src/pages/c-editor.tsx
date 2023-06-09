import {useState, CSSProperties} from 'react';
import {Button, ButtonGroup} from '@mui/material';

import Bluetooth from '../services/bluetooth';
import COnetimeCompile from "../services/c-onetime-compile";
import BSCodeEditorArea from "../components/code-editor-area";
import Grid2 from "@mui/material/Unstable_Grid2";
import BSLogArea from "../components/log-area";
import {Buffer} from "buffer";


const bluetooth = new Bluetooth(0x00ff);

export default function CEditor() {
  const [code, setCode] = useState("int main() {\n return 2; \n}");
  const [log, setLog] = useState("");
  let logString = "";

  const execCode = async () => {
    try {
      // const {values, execFuncOffsets} = await COnetimeCompile(code);
      // const {text, literal, data, rodata, bss} = values;
      // await bluetooth.sendMachineCode(text, literal, data, rodata, bss, execFuncOffsets[0]);
    } catch (error: any) {
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
    <div style={style.box}>
      <Grid2 container spacing={3}>
        <Grid2 style={{height: 50, textAlign: "end"}} xs={12}>
          <ButtonGroup variant="contained" color={"success"}>
            <Button onClick={execCode}>Exec</Button>
            <Button onClick={() => bluetooth.startNotifications(onLogSent)}>Log Start</Button>
            <Button onClick={() => bluetooth.stopLogNotification()}>Log Stop</Button>
          </ButtonGroup>
        </Grid2>
        <Grid2 xs={7}>
          <BSCodeEditorArea code={code} setCode={setCode} language={"c"}/>
        </Grid2>
        <Grid2 xs={5} style={{marginTop:13}}>
          <BSLogArea log={log}/>
        </Grid2>
      </Grid2>
    </div>
  );
}

const style: { [key: string]: CSSProperties } = {
  box: {
    marginTop: 100,
    paddingLeft: 100,
    paddingRight: 100,
    paddingBottom: 100
  },
}