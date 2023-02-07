import {CSSProperties, KeyboardEvent} from 'react';
import CodeEditor from '@uiw/react-textarea-code-editor';
import {Card} from "@mui/material";
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {grey} from "@mui/material/colors";

type Props = {
  code: string,
  setCode: (code: string) => void,
  exitCode: () => void
}

export default function BSCodeEditorCell(props: Props) {
  const onKeyDown = (keyEvent: KeyboardEvent) => {
    if (keyEvent.key === "Enter" && keyEvent.shiftKey) {
      // TODO: 改行してしまうのを防ぎたい。
      props.exitCode();
    }
  }

  const calcRows = () => {
    const rows:number = props.code.split('\n').length;
    return rows > 4 ? rows : 4;
  }

  return (
    <div>
      <Card sx={{display: 'flex', mb:3}} elevation={2} style={{backgroundColor: "#f5f5f5"}}>
        <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}
             style={{backgroundColor: "lightgray", width: 50}}>
          <IconButton
            sx={{color: grey[100], backgroundColor: grey[500], m: 1}}
            size={"small"}
            onClick={props.exitCode}
          >
            <PlayArrowIcon sx={{height: 20, width: 20}}/>
          </IconButton>
        </Box>
        <Box sx={{flex: 'auto'}}>
          <CodeEditor
            value={props.code}
            language="ts"
            placeholder=""
            onChange={(evn) => props.setCode(evn.target.value)}
            style={style.codeEditor}
            onKeyDown={onKeyDown}
            rows={calcRows()}
          />
        </Box>
      </Card>
    </div>
  );
}


const style: { [key: string]: CSSProperties } = {
  codeEditor: {
    fontSize: 14,
    backgroundColor: "#f5f5f5",
    fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace'
  }
}