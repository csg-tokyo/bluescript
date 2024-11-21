import { Tabs, Badge } from "antd"
import type { TabsProps } from 'antd';
import { useContext } from 'react';
import { ReplContext } from '../../context/repl-context';

export default function OutputArea(props: {height: number}) {
  const replContext = useContext(ReplContext)

  const items: TabsProps['items'] = [
      {
        key: '1',
        label: <div>OUTPUT</div>,
        children: <NormalOutputArea output={replContext.output} height={props.height - 70}/>,
      },
      {
        key: '2',
        label: replContext.runtimeError.length > 0 ? <Badge dot><div>ERROR</div></Badge> : <div>ERROR</div>,
        children: <ErrorOutputArea error={replContext.runtimeError} height={props.height - 70}/>,
      },
  ];

  return (
    <div style={{height: props.height, width: '100%', paddingLeft:15, paddingRight: 15}}>
        <Tabs defaultActiveKey="1" items={items} style={{height: "100%"}}/>
    </div>
  )
}

function NormalOutputArea(props: {height: number, output: string[]}) {
  return (
    <div style={{height: props.height, width: '100%', overflow: 'scroll', paddingBottom:100}}>
      { props.output.map((s, id) => <div key={id}>{s}</div>)}
    </div>
  )
}

function ErrorOutputArea(props: {height: number, error: string[]}) {
  return (
    <div style={{height: props.height, width: '100%', color: "red"}}>
      { props.error.map((s, id) => <div key={id}>{s}</div>)}
    </div>
  )
}