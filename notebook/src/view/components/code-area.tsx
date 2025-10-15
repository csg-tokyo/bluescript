import { Result, Button } from 'antd';
import { useContext } from 'react';
import {LoadingOutlined, SmileOutlined } from '@ant-design/icons';
import { ReplContext } from '../../contexts/repl-context';
import { EditingCell, ExecutingCell, ExecutedCell } from './cells';
import styles from './styles.module.css';


export default function CodeArea() {
    const replContext = useContext(ReplContext);
    if (replContext === undefined) {
        throw new Error('ReplContext can only be used in ReplProvider.');
    }
    const url = 'ws://localhost:8080'; // TODO: 要修正

    return (
        <div style={{height: '100%', width: '100%'}}>
            { replContext.state === 'initial' ? (
                <WelcomScreen />
            ) : replContext.state === 'network-connecting' ? (
                <LoadingScreen message={`Connecting to ${url} ...`} />
            ) : replContext.state === 'network-disconnected' ? (
                <ErrorScreen message={`Failed to connect to ${url}`}/>
            ) : replContext.state === 'executing-main' ? (
                <MainExecutionScreen />
            ): (
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

function MainExecutionScreen() {
    const replContext = useContext(ReplContext);
    if (replContext === undefined) {
        throw new Error('ReplContext can only be used in ReplProvider.');
    }
    const state = replContext.mainState.state;
    const message = state === 'initial' ? 'Welcom to BlueScript REPL.'
                    : state === 'failed-to-compile' ? 'Failed to compile.'
                    : state === 'compiling' ? 'Compiling...'
                    : state === 'loading' ? 'Loading...'
                    : state === 'executing' ? 'Executing...'
                    : 'Finish execution.'
    return (
        <div className={styles.statusScreen}>
            { state === 'initial' ? (
                <Result 
                    icon={<SmileOutlined />} 
                    title={message} 
                    extra={<Button type="primary"
                    onClick={replContext.executeMain}
                >
                    Start execution
                </Button>}/>
            ) : state === 'failed-to-compile' ? (
                <Result status="error" title={message} subTitle={replContext.mainState.error}/>
            ) : <Result icon={<SmileOutlined />} title={message}/>
            }
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
                ? <EditingCell cell={replContext.latestCell} setCode={replContext.setCode} onExecuteClick={replContext.executeLatestCell}/>
                : <ExecutingCell cell={replContext.latestCell} />
            }
        </div>
    );
}
