import {useState, CSSProperties} from 'react';
import {Button} from '@mui/material';

import Bluetooth, {CHARACTERISTIC_IDS} from '../services/bluetooth';
import {onetimeCompile} from "../services/network";
import BSCodeEditorArea from "../components/code-editor-area";


const bluetooth = new Bluetooth();

export default function TsEditor() {
  const [program, setProgram] = useState("function main(n: number):number {\n  return n + 2;\n}");

  const exitCode = async () => {
    try {
      const {exe} = await onetimeCompile(program);
      await bluetooth.sendMachineCode(CHARACTERISTIC_IDS.ONETIME, exe);
    } catch (error: any) {
      window.alert(`Failed to compile: ${error.message}`);
    }
  }

  return (
    <div style={{marginTop: 100, paddingLeft: 100, paddingRight: 100, paddingBottom: 100}}>
      <BSCodeEditorArea code={program} setCode={setProgram}/>
      <div style={style.buttonBox}>
        <Button
          variant="contained"
          size='large'
          onClick={exitCode}
        >SEND</Button>
      </div>
    </div>
  );
}

const style: { [key: string]: CSSProperties } = {
  Box: {
    marginTop: 100,
    paddingLeft: 100,
    paddingRight: 100
  },
  buttonBox: {
    marginTop: 20,
    display: "flex",
    justifyContent: "flex-end"
  }
}