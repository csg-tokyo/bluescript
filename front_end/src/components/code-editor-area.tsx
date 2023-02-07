import {CSSProperties} from 'react';
import CodeEditor from '@uiw/react-textarea-code-editor';


type Props = {
  code: string,
  language: "c" | "ts",
  setCode: (code: string) => void,
}

export default function BSCodeEditorArea(props: Props) {
  return (
    <div>
      <small style={{color:"GrayText"}}>{entities[props.language].title}</small>
      <CodeEditor
        value={props.code}
        language={props.language}
        placeholder={entities[props.language].placeholder}
        onChange={(evn) => props.setCode(evn.target.value)}
        padding={15}
        style={style.codeEditor}
      />
    </div>
  );
}

const entities = {
  "c": {
    title: "C language",
    placeholder: "Please enter C code."
  },
  "ts": {
    title: "TypeScript",
    placeholder: "Please enter TypeScript code."
  }
}

const style: { [key: string]: CSSProperties } = {
  codeEditor: {
    fontSize: 14,
    height: window.innerHeight - 200,
    backgroundColor: "#f5f5f5",
    borderStyle: "solid",
    borderColor: "darkgray",
    borderWidth: 1.5,
    fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace'
  },
}