import {useState} from 'react';
import {CSSProperties} from 'react';
import {Button} from '@mui/material';
import {ButtonGroup} from "@mui/material";
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';

import BSCodeEditorCell from "./components/code-editor-cell";
import BSCodeEditorCellExecuted from "./components/code-editor-cell-executed";
import Grid2 from "@mui/material/Unstable_Grid2";
import BSLogArea from "./components/log-area";
import useRepl, {Cell} from '../hooks/use-repl';


export default function Repl() {
  const {replParams, replActions} = useRepl();
  const [useFlash, setUseFlash] = useState(false);

  const onUseFlashChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      setUseFlash(event.target.checked);
      await replActions.reset(useFlash);
  };

  const executionLogStr = (cell:Cell):string => {
    const compileTimeStr = cell.compileTime ? `compile: ${Math.round(cell.compileTime * 1000) / 1000} ms` : "compile: no data"
    const bluetoothTimeStr = cell.bluetoothTime ? `bluetooth: ${Math.round(cell.bluetoothTime * 1000) / 1000} ms` : "bluetooth: no data"
    const executionTime = cell.executionTime ? `execution: ${Math.round(cell.executionTime * 1000) / 1000} ms` : "execution: no data"
    return `${compileTimeStr} | ${bluetoothTimeStr} | ${executionTime}`
  }

  return (
    <div style={{marginTop: 100, paddingLeft: 100, paddingRight: 100, paddingBottom: 100}}>
      {replParams.replState === "unInitialized"
      ? <Grid2 container spacing={3}>
          <Button onClick={() => replActions.reset()} variant="contained">START REPL</Button>
        </Grid2>

      : <Grid2 container spacing={3}>
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
              <Button onClick={() => replActions.reset(useFlash)}>RESET</Button>
            </ButtonGroup>
          </Grid2>
          <Grid2 xs={7}>
            {replParams.executedCells.map((cell, index) => {
              return <BSCodeEditorCellExecuted 
                code={cell.code} executionLog={executionLogStr(cell)} key={index}/>
            })}
            <BSCodeEditorCell code={replParams.currentCell.code} 
              onExecuteClick={() => replActions.execute()} setCode={(code)=>replActions.setCurrentCell({...replParams.currentCell, code})}/>
            <div style={style.compileErrorBox}>{replParams.compileError}</div>
          </Grid2>
          <Grid2 xs={5}>
            <BSLogArea log={replParams.log} />
          </Grid2>
        </Grid2>
      }
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={replParams.replState === "initializing"}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
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
