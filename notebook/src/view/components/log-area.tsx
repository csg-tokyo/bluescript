import {CSSProperties} from 'react';


export type Log = {
  type: "log"|"error", 
  str: string
}

type Props = {
  log: Log[],
}

export default function BSLogArea(props: Props) {
  return (
    <div style={style.logBox}>
      <div style={style.scrollContents}>
        {props.log.map(l => {
          switch (l.type) {
            case "log":
              return <p>{l.str}</p>
            case "error":
              return <p style={{color:"red"}}>{l.str}</p>
            default:
              return <p>{l.str}</p>
          } 
        })}
      </div>
    </div>
  );
}

const style: { [key: string]: CSSProperties } = {
  logBox: {
    fontSize: 14,
    height: window.innerHeight - 200,
    backgroundColor: "#fafafa",
    borderStyle: "solid",
    borderWidth: 1.5,
    borderColor: "darkgray",
    marginTop:5,
    fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace'
  },
  scrollContents: {
    height: 800,
    paddingLeft: 15,
    paddingRight: 15,
    overflowX: "scroll",
    overflowY: "scroll",
    whiteSpace: "pre-wrap"
  }
}