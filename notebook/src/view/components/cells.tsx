import { useCallback, useState } from 'react';
import { Flex, Button, Row, Typography} from 'antd';
import { CaretRightOutlined, LoadingOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import CodeMirror, { EditorState } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import { keymap, EditorView } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { EditingCellT, LoadingCellT, ExecutedCellT } from '../../contexts/repl-context';
import styles from './styles.module.css';

export function EditingCell(props: {cell: EditingCellT, setCode: (code: string) => void, onExecuteClick: () => Promise<void>}) {
    return (
        <div className={styles.cell}>
            <Row>
            <Flex style={{width: '100%'}}>
                <Button shape='circle' type='text' onClick={props.onExecuteClick} style={{marginRight:5}} icon={<CaretRightOutlined style={{fontSize:20}} />}/>
                <CodeEditor onChange={props.setCode} onShiftEnter={props.onExecuteClick} code={props.cell.code}/>
            </Flex>
            </Row>
            { props.cell.compileError &&
                <div className={styles.cellCompileErrorArea}>
                    {props.cell.compileError}
                </div>
            }
        </div>
    );
}

export function LoadingCell(props: {cell: LoadingCellT}) {
    let statusText = () => {
        if (props.cell.state === 'compiling') { return 'Compiling ...' }
        if (props.cell.state === 'sending') { return 'Sending via Bluetooth ...' }
        if (props.cell.state === 'executing') { return 'Executing ...' }
    }

    return (
        <div className={styles.cell}>
            <Row>
            <Flex style={{width: '100%'}}>
                <Button shape='circle' type='text' style={{marginRight:5}} disabled icon={<LoadingOutlined style={{fontSize:20}} />}/>
                <CodeEditor code={props.cell.code} disabled/>
            </Flex>
            </Row>
            <Row justify='end'>
                <Typography.Text style={{color: '#8c8c8c'}}>{statusText()}</Typography.Text>
            </Row>
        </div>
    );
}

export function ExecutedCell(props: {cell: ExecutedCellT}) {
    const handleCopyClick = async () => {
        await global.navigator.clipboard.writeText(props.cell.code);
    }

    const t = props.cell.time;
    const compilation = Math.round(t.compilation * 100) / 100;
    const sending = Math.round(t.sending * 100) / 100;
    const execution = Math.round(t.execution * 100) / 100;
    const statusText = `| compile: ${compilation} ms | sending: ${sending} ms | execution: ${execution} ms |`;

    return (
        <div className={styles.cell}>
            <Row>
            <Flex style={{width: '100%'}}>
                <CopyButton onClick={handleCopyClick}/>
                <CodeEditor code={props.cell.code} disabled/>
            </Flex>
            </Row>
            <Row justify='end'>
                <Typography.Text style={{color: '#8c8c8c'}}>{statusText}</Typography.Text>
            </Row>
        </div>
    );
}

function CopyButton(props: {onClick: ()=>void}) {
    const [isCopied, setIsCopied] = useState(false);

    const handleClick = () => {
        setIsCopied(true);
        props.onClick();
        setTimeout(() => {
            setIsCopied(false);
        }, 700);
    }

    return (
        <Button 
            shape='circle' 
            type='text' 
            onClick={handleClick} 
            style={{marginRight:5, color: isCopied ? '#1890ff' : '#8c8c8c'}} 
            icon={
                <div className={styles.copyButtonIconContainer}>
                    <CopyOutlined className={`${styles.copyButtonIconBase} ${isCopied ? styles.copyButtonIconHidden : styles.copyButtonIconVisible}`}/>
                    <CheckOutlined className={`${styles.copyButtonIconBase} ${isCopied ? styles.copyButtonIconVisible : styles.copyButtonIconHidden}`}/>
                </div>
            }
        />
    )
}

const removeBorderTheme = EditorView.theme({
  '&': {
    border: 'none',
    outline: 'none',
  },
  '&.cm-focused': {
    outline: 'none',
    border: 'none',
  },
});

function CodeEditor(props: {
    onChange?: (code: string) => void, 
    onShiftEnter?: () => Promise<void>,
    code: string, 
    disabled?:boolean
}) {
    const handleChange = useCallback((value: string) => {
        props.onChange && props.onChange(value);
    }, [props]);

    const customKeymap = keymap.of([
        {
            key: 'Shift-Enter',
            run: () => {
                if (props.onShiftEnter) {
                    props.onShiftEnter();
                    return true;
                }
                return false;
            },
        },
        indentWithTab,
    ]);

    return (
        <CodeMirror
            value={props.code}
            className={styles.cellCodeEditor}
            extensions={[
                javascript({ jsx: true, typescript: true }),
                removeBorderTheme,
                customKeymap,
                EditorView.editable.of(!props.disabled),
                EditorState.readOnly.of(!!props.disabled)
            ]}
            basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                defaultKeymap: false
            }}
            theme={vscodeLight}
            onChange={handleChange}
        />
    )
}

