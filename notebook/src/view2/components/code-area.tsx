import { Flex, Button, Checkbox, Row, Typography, Spin} from 'antd';
import { ReloadOutlined, CaretRightOutlined, LoadingOutlined, CopyOutlined } from '@ant-design/icons';
import CodeEditor from '@uiw/react-textarea-code-editor';
import type { CellT } from '../../utils/type';
import { useContext } from 'react';
import { ReplContext } from '../../context/repl-context';


export default function CodeArea() {
    const replContext = useContext(ReplContext)

    return (
        <div style={{height: '100%', width: '100%'}}>
            {replContext.state === 'initial' ? (
                <InitialScreen />
            ) : replContext.state === 'loading' ? (
                <LoadingScreen />
            ) : (
                <ActivatedScreen />
            )}
        </div>
    )
}

function InitialScreen() {
    const replContext = useContext(ReplContext)

    return (
        <div style={{height: '100%', width: '100%', justifyItems: 'center', alignContent: 'center'}}>
            <Typography.Title level={3}>Click Here to Start Coding</Typography.Title>
            <Button type="primary" onClick={replContext.reset} size='large'>Start</Button>
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

function ActivatedScreen() {
    const replContext = useContext(ReplContext)
    return (
        <div>
            <ButtonBar />
            <div style={{paddingTop: 30, paddingBottom: 250, overflow: 'scroll', height: '100%'}}>
                { replContext.postExecutionCells.map(cell => <Cell cell={cell} key={cell.id} />)}
                <Cell cell={replContext.latestCell} key={replContext.latestCell.id} />
            </div>
        </div>
    )
}

function ButtonBar() {
    const replContext = useContext(ReplContext)
    return (
        <Flex justify='start' align='center' style={{height:36, boxShadow: '0px 0px 4px gray'}}>
            <Button icon={<ReloadOutlined />} type='text' onClick={replContext.reset}>Reset</Button>
            <Checkbox onChange={(e)=>replContext.updateUseJIT(e.target.checked)}>Use JIT</Checkbox>
            <Checkbox onChange={(e)=>replContext.updateUseFlash(e.target.checked)}>Use Flash</Checkbox>
        </Flex>
    )
}

function Cell(props: {
    cell: CellT,
    onExecuteClick?: () => Promise<void>,
}) {
    const state = props.cell.state
    let border = state === 'user-writing' ? 'solid #69c0ff 1px' : 'solid #bfbfbf 1px'

    const onCopyClick = async () => {
        await global.navigator.clipboard.writeText(props.cell.code);
    }

    let CellButton = () => {
        if (state === 'user-writing')
            return <Button shape='circle' type='text' onClick={props.onExecuteClick} style={{marginRight:5}} icon={<CaretRightOutlined style={{fontSize:20}} />}/>
        else if (state === 'compiling' || state === 'sending' || state === 'executing')
            return <Button shape='circle' type='text' style={{marginRight:5}} disabled icon={<LoadingOutlined style={{fontSize:20}} />}/>
        else 
            return <Button shape='circle' type='text' onClick={onCopyClick} style={{marginRight:5, color: '#8c8c8c'}} icon={<CopyOutlined style={{fontSize:20}} />}/>
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

