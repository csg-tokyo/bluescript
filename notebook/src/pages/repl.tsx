import {useState, useEffect} from 'react';
import {CSSProperties} from 'react';
import {Button} from '@mui/material';
import {ButtonGroup} from "@mui/material";
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

import Bluetooth, {MAX_MTU} from '../services/bluetooth';
import { BufferGenerator, BS_CMD} from '../services/buffer-generator';
import * as network from "../services/network"
import BSCodeEditorCell from "../components/code-editor-cell";
import BSCodeEditorCellDisabled from "../components/code-editor-cell-disabled";
import {Buffer} from "buffer";
import Grid2 from "@mui/material/Unstable_Grid2";
import BSLogArea from "../components/log-area";
import { CompileError } from '../utils/error';

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
      const compileResult = await network.compile(code, useFlash);
      console.log(compileResult);
      const bufferGenerator = new BufferGenerator(MAX_MTU);
      bufferGenerator.loadToRAM(compileResult.iram.address, Buffer.from(compileResult.iram.data, "hex"));
      bufferGenerator.loadToRAM(compileResult.dram.address, Buffer.from(compileResult.dram.data, "hex"));
      bufferGenerator.loadToFlash(compileResult.flash.address, Buffer.from(compileResult.flash.data, "hex"));
      bufferGenerator.jump(compileResult.entryPoint);
      const bleData = bufferGenerator.generate();
      console.log(bleData);
      await bluetooth.sendBuffers(bleData);
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

  const onResetPushed = async () => {
    const bufferGenerator = new BufferGenerator(MAX_MTU);
    bufferGenerator.reset();
    try {
      await bluetooth.sendBuffers(bufferGenerator.generate())
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
    setUseFlash(event.target.checked);
    await onResetPushed();
  };


  // TODO: Log parserが必要
  const onReceiveLog = async (event: Event) => {
    // @ts-ignore
    const value = event.target.value as any;
    const cmd = value.getUint8(0, true);
    switch (cmd) {
      case BS_CMD.RESULT_LOG:
        // | cmd (1byte) | log string |
        const newLog = Buffer.from(value.buffer.slice(1)).toString();
        setLog(currentLog => currentLog + newLog);
        return;
      case BS_CMD.RESULT_MEMINFO:
          // | cmd (1byte) | iram address (4byte) | iram size (4byte) | dram address | dram size | flash address | flash size |
          const memInfo = {
            iram:{address:value.getUint32(1, true), size:value.getUint32(5, true)},
            dram:{address:value.getUint32(9, true), size:value.getUint32(13, true)},
            flash:{address:value.getUint32(17, true), size:value.getUint32(21, true)}
          }
          console.log(memInfo);
          network.reset(memInfo).then(() => {
            setExitedCodes([]);
            setCode("");
            setLog("");
            setCompileError("");
          }).catch(e => {
            console.log(e);
          })
          return;
      case BS_CMD.RESULT_EXECTIME:
        console.log("exec time: ", value.getFloat32(1, true));
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
            <Button onClick={onResetPushed}>RESET</Button>
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
