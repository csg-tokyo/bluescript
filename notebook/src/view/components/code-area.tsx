import { Flex, Button, Checkbox, Row, Typography, Spin, Result} from 'antd';
import { ReloadOutlined, CaretRightOutlined, LoadingOutlined, CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import CodeEditor from '@uiw/react-textarea-code-editor';
import { CellStateT, type CellT } from '../../utils/type';
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
                <LoadingScreen message='Loading' />
            ) : replContext.state === 'installing' ? (
                <LoadingScreen message='Installing' />
            ) : replContext.state === 'successfully installed' ? (
                <SuccessfullyInstalledScreen />
            ) : replContext.state === 'failed to install' ? (
                <FailedToInstallScreen />
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

function LoadingScreen(props: {message: string}) {
    return (
        <div style={{height: '100%', width: '100%', justifyItems: 'center', alignContent: 'center'}}>
            <Spin tip={props.message} size="large">
                <div style={{height: 100, width: 100}}></div>
            </Spin>
        </div>
    )
}

function SuccessfullyInstalledScreen() {
    return (
        <div style={{height: '100%', width: '100%', justifyItems: 'center', alignContent: 'center'}}>
            <Result 
            status="success" 
            title="Successfully Installed Your Application."
            subTitle="Please reboot your device."
            />
        </div>
    )
}

function FailedToInstallScreen() {
    return (
        <div style={{height: '100%', width: '100%', justifyItems: 'center', alignContent: 'center'}}>
            <Result status="warning" title="Failed To Install Your Application."/>
        </div>
    )
}

function ActivatedScreen() {
    const replContext = useContext(ReplContext)
    return (
        <div>
            <ButtonBar />
            <div style={{paddingTop: 30, paddingBottom: 250, overflow: 'scroll', height: '100%'}}>
                { replContext.postExecutionCells.map(cell => <Cell cell={cell} key={cell.compileId} />)}
                <Cell 
                    cell={replContext.latestCell} 
                    onExecuteClick={replContext.executeLatestCell} 
                    setCellCode={replContext.setLatestCellCode}
                    key={replContext.latestCell.compileId} 
                />
            </div>
        </div>
    )
}

function ButtonBar() {
    const replContext = useContext(ReplContext)
    return (
        <Flex justify='start' align='center' style={{height:36, boxShadow: '0px 0px 4px gray'}}>
            <Button icon={<ReloadOutlined />} size='small' type='text' onClick={replContext.resetStart}>Reset</Button>
            <Button icon={<DownloadOutlined />} size='small' type='text' onClick={replContext.install}>Install</Button>
            <Checkbox onChange={(e)=>replContext.updateUseJIT(e.target.checked)} checked={replContext.useJIT} style={{marginLeft:10}}>Use JIT</Checkbox>
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
    let border = state === CellStateT.UserWriting ? `solid ${theme.primary} 1px` : `solid ${theme.boarder.gray} 1px`

    const onCopyClick = async () => {
        await global.navigator.clipboard.writeText(props.cell.code);
    }

    let CellButton = () => {
        if (state === CellStateT.UserWriting)
            return <Button shape='circle' type='text' onClick={() => {props.onExecuteClick && props.onExecuteClick()}} style={{marginRight:5}} icon={<CaretRightOutlined style={{fontSize:20}} />}/>
        else if (state === CellStateT.Compiling || state === CellStateT.Sending || state === CellStateT.Executing)
            return <Button shape='circle' type='text' style={{marginRight:5}} disabled icon={<LoadingOutlined style={{fontSize:20}} />}/>
        else 
            return <Button shape='circle' type='text' onClick={onCopyClick} style={{marginRight:5, color: theme.text.gray1}} icon={<CopyOutlined style={{fontSize:20}} />}/>
    }

    let statusText = () => {
        if (state === CellStateT.Compiling) { return 'Compiling ...' }
        if (state === CellStateT.Sending) { return 'Sending ...' }
        if (state === CellStateT.Executing) { return 'Executing ...' }
        if (state === CellStateT.Done) {
            const t = props.cell.time;
            const compile = t.compile ? Math.round(t.compile * 100) / 100 : '??'
            const bluetooth = t.send ? Math.round(t.send * 100) / 100 : '??'
            const execution = t.execute ? Math.round(t.execute * 100) / 100 : '??'
            return `| compile: ${compile} ms | bluetooth: ${bluetooth} ms | execution: ${execution} ms |`
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
                    disabled = {props.cell.state !== CellStateT.UserWriting}
                    onKeyDown={(e) => {if (e.key === 'Enter' && e.shiftKey && props.onExecuteClick) props.onExecuteClick()}}
                    onChange={(e) => props.setCellCode ? props.setCellCode(e.target.value) : 0 }
                />
            </Flex>
            </Row>
            { props.cell.state === CellStateT.UserWriting && props.cell.compileError !== undefined &&
                <div style={{ marginLeft: 50, justifyContent:'start'}}>
                    { props.cell.compileError.map( (message, id) => 
                        <div style={{color: theme.red, fontSize: 16}} key={id}>{message}</div>
                    )}
                </div>
            }
            <Row justify='end'>
                <Typography.Text style={{color: theme.text.gray1}}>{statusText()}</Typography.Text>
            </Row>
        </div>
    )
}

