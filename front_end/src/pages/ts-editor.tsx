import {useState, CSSProperties} from 'react';
import {Button} from '@mui/material';

import Bluetooth from '../services/bluetooth';
import tsOnetimeCompile from "../services/ts-onetime-compile";
import BSCodeEditorArea from "../components/code-editor-area";


const bluetooth = new Bluetooth(0x00ff);

export default function TsEditor() {
  const [code, setCode] = useState("function main(n: number):number {\n  return n + 2;\n}");

  const exitCode = async () => {
    try {
      const {exe} = await tsOnetimeCompile(code);
      // await bluetooth.sendMachineCode(exe);
    } catch (error: any) {
      window.alert(`Failed to compile: ${error.message}`);
    }
  }

  return (
    <div style={{marginTop: 100, paddingLeft: 100, paddingRight: 100, paddingBottom: 100}}>
      <BSCodeEditorArea code={code} setCode={setCode} language={"ts"}/>
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