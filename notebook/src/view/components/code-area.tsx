import { Flex, Button, Row, Typography, Result} from 'antd';
import { CaretRightOutlined, LoadingOutlined, CopyOutlined, SmileOutlined } from '@ant-design/icons';
import CodeEditor from '@uiw/react-textarea-code-editor';
import { EditingCellT, LoadingCellT, ExecutedCellT, ReplContext } from '../../contexts/repl-context';
import { useContext, useRef } from 'react';
import styles from './styles.module.css';


export default function CodeArea() {
    const replContext = useContext(ReplContext);
    if (replContext === undefined) {
        throw new Error('ReplContext can only be used in ReplProvider.');
    }
    const url = 'http://localhost:3000/'; // TODO: 要修正
    const mainFilePath = './index.ts'; // TODO: 要修正

    return (
        <div style={{height: '100%', width: '100%'}}>
            {replContext.state === 'initial' ? (
                <WelcomScreen />
            ) : replContext.state === 'network-connecting' ? (
                <LoadingScreen message={`Connecting to ${url} ...`} />
            ) : replContext.state === 'network-disconnected' ? (
                <ErrorScreen message={`Failed to connect to ${url}`}/>
            ) : replContext.state === 'executing-main' ? (
                <LoadingScreen message={`Executing ${mainFilePath} ...`} /> 
            ) : (
                <ActivatedScreen />
            )}
        </div>
    )
}

function WelcomScreen() {
    return (
        <div className={styles.statusScreen}>
            <Result 
                icon={<SmileOutlined />}
                title='Welcom to BlueScript REPL.'
            />
        </div>
    );
}

function LoadingScreen(props: {message: string}) {
    return (
        <div className={styles.statusScreen}>
            <Result 
                icon={<LoadingOutlined style={{fontSize: 50}}/>}
                title={props.message}
            />
        </div>
    )
}

function ErrorScreen(props: {message: string, subMessage?: string}) {
    return (
        <div className={styles.statusScreen}>
            <Result 
                status="error" 
                title={props.message}
                subTitle={props.subMessage}
            />
        </div>
    );
}


function ActivatedScreen() {
    const replContext = useContext(ReplContext);
    if (replContext === undefined) {
        throw new Error('ReplContext can only be used in ReplProvider.');
    }
    
    return (
        <div className={styles.activatedScreen}>
            { replContext?.executedCells.map(cell => <ExecutedCell cell={cell} key={cell.id} />)}
            { replContext.latestCell.state === 'editing'
                ? <EditableCell cell={replContext.latestCell} setCode={replContext.setCode} onExecuteClick={replContext.execute}/>
                : <LoadingCell cell={replContext.latestCell} />
            }
        </div>
    );
}

function EditableCell(props: {cell: EditingCellT, setCode: (code: string) => void, onExecuteClick: () => Promise<void>}) {
    const handleShiftEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && e.shiftKey) {
            props.onExecuteClick();
        }
    }

    return (
        <div className={styles.cell}>
            <Row>
            <Flex style={{width: '100%'}}>
                <Button shape='circle' type='text' onClick={props.onExecuteClick} style={{marginRight:5}} icon={<CaretRightOutlined style={{fontSize:20}} />}/>
                <CodeEditor
                    value={props.cell.code}
                    language="ts"
                    placeholder=""
                    className={styles.cellCodeEditor}
                    onKeyDown={handleShiftEnter}
                    onChange={(e) => props.setCode(e.target.value)}
                />
            </Flex>
            </Row>
            { props.cell.compileError.length > 0 &&
                <div className={styles.cellCompileErrorArea}>
                    { props.cell.compileError.map( (message, id) => 
                        <div key={id}>{message}</div>
                    )}
                </div>
            }
        </div>
    );
}

function LoadingCell(props: {cell: LoadingCellT}) {
    let statusText = () => {
        if (props.cell.state === 'compiling') { return 'Compiling ...' }
        if (props.cell.state === 'sending') { return 'Sending ...' }
        if (props.cell.state === 'executing') { return 'Executing ...' }
    }

    return (
        <div className={styles.cell}>
            <Row>
            <Flex style={{width: '100%'}}>
                <Button shape='circle' type='text' style={{marginRight:5}} disabled icon={<LoadingOutlined style={{fontSize:20}} />}/>
                <CodeEditor value={props.cell.code} language="ts" placeholder="" className={styles.cellCodeEditor} disabled/>
            </Flex>
            </Row>
            <Row justify='end'>
                <Typography.Text style={{color: '#8c8c8c'}}>{statusText()}</Typography.Text>
            </Row>
        </div>
    );
}

function ExecutedCell(props: {cell: ExecutedCellT}) {
    const onCopyClick = async () => {
        await global.navigator.clipboard.writeText(props.cell.code);
    }

    const time = props.cell.time;
    const statusText = `| compile: ${time.compilation} ms | sending: ${time.sending} ms | execution: ${time.execution} ms |`

    return (
        <div className={styles.cell}>
            <Row>
            <Flex style={{width: '100%'}}>
                <Button shape='circle' type='text' onClick={onCopyClick} style={{marginRight:5, color: '#8c8c8c'}} icon={<CopyOutlined style={{fontSize:20}} />}/>
                <CodeEditor value={props.cell.code} language="ts" placeholder="" className={styles.cellCodeEditor} disabled/>
            </Flex>
            </Row>
            <Row justify='end'>
                <Typography.Text style={{color: '#8c8c8c'}}>{statusText}</Typography.Text>
            </Row>
        </div>
    );
}

