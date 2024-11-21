import { useState } from 'react';
import { Splitter, ConfigProvider} from 'antd';
import ReplProvider from '../context/repl-context';
import CodeArea from './components/code-area';
import OutputArea from './components/output-area';
import SystemArea from './components/system-area';


export default function Home() {
    const [outputAreaHeight, setOutputAreaHeight] = useState((window.innerHeight-48) * 0.5)

    return (
        <ConfigProvider
            theme={{components: {Splitter: {splitBarDraggableSize: 0}}}}>
        <ReplProvider>
            <Splitter>
                <Splitter.Panel defaultSize="65%" min="50%" max="80%" style={{overflow: 'hidden'}}>
                    <CodeArea />
                </Splitter.Panel>
                <Splitter.Panel>
                <Splitter layout='vertical' onResize={(size) => setOutputAreaHeight(size[1])}>
                    <Splitter.Panel defaultSize="50%" min="30%" max="70%" style={{overflow: 'hidden'}}>
                    <SystemArea />
                        </Splitter.Panel>
                    <Splitter.Panel>
                        <OutputArea height={outputAreaHeight} />
                    </Splitter.Panel>
                </Splitter>
                </Splitter.Panel>
            </Splitter>
        </ReplProvider>
        </ConfigProvider>
    )
}