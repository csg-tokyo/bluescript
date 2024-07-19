import {useState, useEffect} from 'react';
import {CSSProperties} from 'react';
import {Button} from '@mui/material';
import {ButtonGroup} from "@mui/material";
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

import Bluetooth, {MAX_MTU} from '../services/bluetooth';
import { BufferGenerator } from '../services/buffer-generator';
import * as network from "../services/network"
import BSCodeEditorCell from "../components/code-editor-cell";
import BSCodeEditorCellDisabled from "../components/code-editor-cell-disabled";
import {Buffer} from "buffer";
import Grid2 from "@mui/material/Unstable_Grid2";
import BSLogArea from "../components/log-area";
import { CompileError } from '../utils/error';

const RESULT_LOG_CMD = 0x06;
const RESULT_FADDRESS_CMD = 0x07;


const bluetooth = new Bluetooth();

export default function Repl() {
  const [code, setCode] = useState("");
  const [exitedCodes, setExitedCodes] = useState<string[]>([]);
  const [log, setLog] = useState("");
  const [compileError, setCompileError] = useState("");
  const [useFlash, setUseFlash] = useState(false);

  useEffect(() => {
    bluetooth.setNotificationHandler(onReceiveLog);
  },[])

  const exitCode = async () => {
    setCompileError("");
    try {
      if (useFlash) {
        const compileResult = await network.replCompileWithFlash(code);
        const bufferGenerator = new BufferGenerator(MAX_MTU);
        console.log(compileResult)
        bufferGenerator.loadToRAM(compileResult.dataAddress, Buffer.from(compileResult.data, "hex"));
        bufferGenerator.loadToFlash(compileResult.textAddress, Buffer.from(compileResult.text, "hex"));
        bufferGenerator.loadToFlash(compileResult.rodataAddress, Buffer.from(compileResult.rodata, "hex"));
        bufferGenerator.jump(compileResult.entryPoint);
        const bleData = bufferGenerator.generate();
        console.log(bleData);
        await bluetooth.sendBuffers(bleData);
      } else {
        const compileResult = await network.replCompile(code);
        const bufferGenerator = new BufferGenerator(MAX_MTU);
        bufferGenerator.loadToRAM(compileResult.textAddress, Buffer.from(compileResult.text, "hex"));
        bufferGenerator.loadToRAM(compileResult.dataAddress, Buffer.from(compileResult.data, "hex"));
        bufferGenerator.jump(compileResult.entryPoint);
        const bleData = bufferGenerator.generate();
        await bluetooth.sendBuffers(bleData);
      }
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
    const bufferGenerator = new BufferGenerator(MAX_MTU);
    bufferGenerator.reset();
    try {
      await Promise.all([
        network.clear(),
        bluetooth.sendBuffers(bufferGenerator.generate())
      ]);
      setExitedCodes([]);
      setCode("");
      setLog("");
      setCompileError("");
    } catch (error: any) {
      console.log(error);
      window.alert(`Failed to clear: ${error.message}`);
    }
  }

  const onUseFlashChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.checked){
      setUseFlash(event.target.checked);
      return;
    }
      
    try {
      const bufferGenerator = new BufferGenerator(MAX_MTU);
      bufferGenerator.readFlashAddress();
      bluetooth.sendBuffers(bufferGenerator.generate());
      setUseFlash(event.target.checked);
    } catch (error: any) {
      console.log(error);
      window.alert(`Failed to clear: ${error.message}`);
    }
  };


  const onReceiveLog = (event: Event) => {
    // @ts-ignore
    const cmd = event.target.value.getUint8(0, true);
    switch (cmd) {
      case RESULT_FADDRESS_CMD:
        // | cmd (1byte) | address (4byte) |
        // @ts-ignore
        const faddress = event.target.value.getUint32(1, true);
        network.setFlashAddress(faddress);
        console.log("faddress", faddress);
        return;
      case RESULT_LOG_CMD:
        // | cmd (1byte) | log string |
        // @ts-ignore
        const newLog = Buffer.from(event.target.value.buffer.slice(1)).toString();
        setLog(currentLog => currentLog + newLog);
        return;
      default:
        console.log(`unknown cmd: ${cmd}`);
    }
  }

  return (
    <div style={{marginTop: 100, paddingLeft: 100, paddingRight: 100, paddingBottom: 100}}>
      <Grid2 container spacing={3}>
        <Grid2 style={{height: 50, textAlign: "end"}} xs={12}>
        <FormControlLabel
          value="start"
          style={{marginRight: 20}}
          control={
            <Switch checked={useFlash} onChange={onUseFlashChange} inputProps={{ 'aria-label': 'controlled' }}/>
          }
          label="Use Flash"
          labelPlacement="start"
        />
          <ButtonGroup variant="contained" color={"success"}>
            <Button onClick={onClearPushed}>Clear</Button>
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
