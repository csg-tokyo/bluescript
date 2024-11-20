import { Flex, Button, Checkbox, Row, Typography, Spin} from 'antd';
import { ReloadOutlined, CaretRightOutlined, LoadingOutlined, CopyOutlined } from '@ant-design/icons';
import CodeEditor from '@uiw/react-textarea-code-editor';
import type { CellT } from '../../utils/type';


export default function CodeArea(props: {
    state: 'initial' | 'loading' | 'activated'
}) {
    return (
        <div style={{height: '100%', width: '100%'}}>
            {props.state === 'initial' ? (
                <InitialScreen />
            ) : props.state === 'loading' ? (
                <LoadingScreen />
            ) : (
                <ActivatedScreen />
            )}
        </div>
    )
}

function InitialScreen(props: {
    onStartClick: () => void
}) {
    return (
        <div style={{height: '100%', width: '100%', justifyItems: 'center', alignContent: 'center'}}>
            <Typography.Title level={3}>Click Here to Start Coding</Typography.Title>
            <Button type="primary" size='large'>Start</Button>
        </div>
    )
}

function LoadingScreen() {
    return (
        <div style={{height: '100%', width: '100%', justifyItems: 'center', alignContent: 'center'}}>
            <Spin tip="Initializing" size="large">
                <div style={{height: 100, width: 100}}></div>
            </Spin>
        </div>
    )
}

function ActivatedScreen(props: {
    onResetClick: () => void,
    onUseJITChange: () => void,
    onUseFlashChange: () => void,
    cells: CellT[]
}) {
    return (
        <div>
            <ButtonBar 
                onResetClick={props.onResetClick} 
                onUseJITChange={props.onUseJITChange} 
                onUseFlashChange={props.onUseFlashChange} 
            />
            <div style={{paddingTop: 30, paddingBottom: 250, overflow: 'scroll', height: '100%'}}>
                { props.cells.map(cell => <Cell cell={cell} />)}
            </div>
        </div>
    )
}

function ButtonBar(props: {
    onResetClick: () => void,
    onUseJITChange: () => void,
    onUseFlashChange: () => void
}) {
    return (
        <Flex justify='start' align='center' style={{height:36, boxShadow: '0px 0px 4px gray'}}>
            <Button icon={<ReloadOutlined />} type='text' onClick={props.onResetClick}>Reset</Button>
            <Checkbox onChange={props.onUseJITChange}>Use JIT</Checkbox>
            <Checkbox onChange={props.onUseFlashChange}>Use Flash</Checkbox>
        </Flex>
    )
}

function Cell(props: {
    cell: CellT,
    onExecuteClick: (cell: CellT) => void,
    onCopyClick: (cell: CellT) => void
}) {
    const state = props.cell.state
    let border = state === 'user-writing' ? 'solid #69c0ff 1px' : 'solid #bfbfbf 1px'

    let CellButton = () => {
        if (state === 'user-writing')
            return <Button shape='circle' type='text' style={{marginRight:5}} icon={<CaretRightOutlined style={{fontSize:20}} />}/>
        else if (state === 'compiling' || state === 'sending' || state === 'executing')
            return <Button shape='circle' type='text' style={{marginRight:5}} disabled icon={<LoadingOutlined style={{fontSize:20}} />}/>
        else 
            return <Button shape='circle' type='text' style={{marginRight:5, color: '#8c8c8c'}} icon={<CopyOutlined style={{fontSize:20}} />}/>
    }

    let statusText = () => {
        if (state === 'compiling') { return 'Compiling ...' }
        if (state === 'sending') { return 'Sending ...' }
        if (state === 'executing') { return 'Executing ...' }
        if (state === 'done') {
            const t = props.cell.time;
            return `| compile: ${t?.compile ?? '??'} ms | bluetooth: ${t?.bluetooth ?? '??'} ms | execution: ${t?.execution ?? '??'} ms |`
        }
    }

    return (
        <div style={{width: '100%', paddingRight:30, paddingLeft: 15}}>
            <Row>
            <Flex style={{width: '100%'}}>
                <CellButton />
                <CodeEditor
                    value={props.cell.code}
                    language="ts"
                    placeholder=""
                    style={{
                        fontSize: 14,
                        backgroundColor: '#f0f0f0',
                        width:'100%',
                        minHeight: 50, 
                        border,
                        fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace'
                    }}
                    onKeyDown={(e) => {if (e.key === 'Enter' && e.shiftKey) console.log("Shift Enter")}}
                />
            </Flex>
            </Row>
            <Row justify='end'>
                <Typography.Text style={{color: '#8c8c8c'}}>{statusText()}</Typography.Text>
            </Row>
        </div>
    )
}

