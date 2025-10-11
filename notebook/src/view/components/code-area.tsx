import { Result } from 'antd';
import { useContext } from 'react';
import {LoadingOutlined, SmileOutlined } from '@ant-design/icons';
import { ReplContext } from '../../contexts/repl-context';
import { EditingCell, LoadingCell, ExecutedCell } from './cells';
import styles from './styles.module.css';


export default function CodeArea() {
    const replContext = useContext(ReplContext);
    if (replContext === undefined) {
        throw new Error('ReplContext can only be used in ReplProvider.');
    }
    const url = 'http://localhost:3000/'; // TODO: 要修正

    return (
        <div style={{height: '100%', width: '100%'}}>
            { replContext.state === 'initial' ? (
                <WelcomScreen />
            ) : replContext.state === 'network-connecting' ? (
                <LoadingScreen message={`Connecting to ${url} ...`} />
            ) : replContext.state === 'network-disconnected' ? (
                <ErrorScreen message={`Failed to connect to ${url}`}/>
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
                ? <EditingCell cell={replContext.latestCell} setCode={replContext.setCode} onExecuteClick={replContext.executeLatestCell}/>
                : <LoadingCell cell={replContext.latestCell} />
            }
        </div>
    );
}
