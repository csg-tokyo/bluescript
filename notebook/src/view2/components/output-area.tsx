import { Tabs, Badge } from "antd"
import type { TabsProps } from 'antd';



export default function OutputArea(props: {height: number}) {
  const items: TabsProps['items'] = [
      {
        key: '1',
        label: <div>OUTPUT</div>,
        children: <NormalOutputArea height={props.height - 70}/>,
      },
      {
        key: '2',
        label: <Badge dot><div>ERROR</div></Badge>,
        children: <ErrorOutputArea height={props.height - 70}/>,
      },
  ];

  return (
    <div style={{height: props.height, width: '100%', paddingLeft:15, paddingRight: 15}}>
        <Tabs defaultActiveKey="1" items={items} style={{height: "100%"}}/>
    </div>
  )
}

function NormalOutputArea(props: {height: number}) {
  return (
    <div style={{height: props.height, width: '100%', overflow: 'scroll', paddingBottom:100}}>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
      foo<br/>
    </div>
  )
}

function ErrorOutputArea(props: {height: number}) {
  return (
    <div style={{height: props.height, width: '100%', color: "red"}}>Error** dynamic type error</div>
  )
}