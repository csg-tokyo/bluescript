import { Flex, Button, Checkbox, Row, Typography, Spin} from 'antd';
import { ReloadOutlined, CaretRightOutlined, LoadingOutlined, CopyOutlined } from '@ant-design/icons';
import CodeEditor from '@uiw/react-textarea-code-editor';
import type { CellT } from '../../utils/type';
import { useContext } from 'react';
import { ReplContext } from '../../hooks/repl-context';
import { ThemeContext } from '../../hooks/theme-context';


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
            <Button type="primary" onClick={replContext.resetStart} size='large'>Start</Button>
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
                <Cell 
                    cell={replContext.latestCell} 
                    onExecuteClick={replContext.executeLatestCell} 
                    setCellCode={replContext.setLatestCellCode}
                    key={replContext.latestCell.id} 
                />
            </div>
        </div>
    )
}

function ButtonBar() {
    const replContext = useContext(ReplContext)
    return (
        <Flex justify='start' align='center' style={{height:36, boxShadow: '0px 0px 4px gray'}}>
            <Button icon={<ReloadOutlined />} type='text' onClick={replContext.resetStart}>Reset</Button>
            <Checkbox onChange={(e)=>replContext.updateUseJIT(e.target.checked)} checked={replContext.useJIT}>Use JIT</Checkbox>
            <Checkbox onChange={(e)=>replContext.updateUseFlash(e.target.checked)} checked={replContext.useFlash}>Use Flash</Checkbox>
        </Flex>
    )
}

function Cell(props: {
    cell: CellT,
    onExecuteClick?: () => Promise<void>,
    setCellCode?: (code: string) => void
}) {
    const theme = useContext(ThemeContext)

    const state = props.cell.state
    let border = state === 'user-writing' ? `solid ${theme.primary} 1px` : `solid ${theme.boarder.gray} 1px`

    const onCopyClick = async () => {
        await global.navigator.clipboard.writeText(props.cell.code);
    }

    let CellButton = () => {
        if (state === 'user-writing')
            return <Button shape='circle' type='text' onClick={() => {props.onExecuteClick && props.onExecuteClick()}} style={{marginRight:5}} icon={<CaretRightOutlined style={{fontSize:20}} />}/>
        else if (state === 'compiling' || state === 'sending' || state === 'executing')
            return <Button shape='circle' type='text' style={{marginRight:5}} disabled icon={<LoadingOutlined style={{fontSize:20}} />}/>
        else 
            return <Button shape='circle' type='text' onClick={onCopyClick} style={{marginRight:5, color: theme.text.gray1}} icon={<CopyOutlined style={{fontSize:20}} />}/>
    }

    let statusText = () => {
        if (state === 'compiling') { return 'Compiling ...' }
        if (state === 'sending') { return 'Sending ...' }
        if (state === 'executing') { return 'Executing ...' }
        if (state === 'done') {
            const t = props.cell.time;
            const compile = t?.compile ? Math.round(t?.compile * 100) / 100 : '??'
            const bluetooth = t?.bluetooth ? Math.round(t?.bluetooth * 100) / 100 : '??'
            const execution = t?.execution ? Math.round(t?.execution * 100) / 100 : '??'
            return `| compile: ${compile ?? '??'} ms | bluetooth: ${bluetooth ?? '??'} ms | execution: ${execution ?? '??'} ms |`
        }
    }

    return (
        <div style={{width: '100%', paddingRight:30, paddingLeft: 15, paddingBottom: 20}}>
            <Row>
            <Flex style={{width: '100%'}}>
                <CellButton />
                <CodeEditor
                    value={props.cell.code}
                    language="ts"
                    placeholder=""
                    style={{
                        fontSize: 14,
                        backgroundColor: theme.background.gray,
                        width:'100%',
                        minHeight: 50, 
                        border,
                        fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace'
                    }}
                    disabled = {props.cell.state !== 'user-writing'}
                    onKeyDown={(e) => {if (e.key === 'Enter' && e.shiftKey && props.onExecuteClick) props.onExecuteClick()}}
                    onChange={(e) => props.setCellCode ? props.setCellCode(e.target.value) : 0 }
                />
            </Flex>
            </Row>
            { props.cell.compileError !== '' &&
                <Row justify='start' style={{ marginLeft: 50}}>
                    <Typography.Text style={{color: theme.red, fontSize: 16}}>{props.cell.compileError}</Typography.Text>
                </Row>
            }
            <Row justify='end'>
                <Typography.Text style={{color: theme.text.gray1}}>{statusText()}</Typography.Text>
            </Row>
        </div>
    )
}

