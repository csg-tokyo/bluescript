import { Splitter, ConfigProvider} from 'antd';
import ReplProvider from '../contexts/repl-context';
import CodeArea from './components/code-area';
import OutputArea from './components/output-area';


export default function Home() {
    return (
        <ConfigProvider
            theme={{components: {Splitter: {splitBarDraggableSize: 0}}}}>
        <ReplProvider>
            <Splitter>
                <Splitter.Panel defaultSize="65%" min="50%" max="80%">
                    <CodeArea />
                </Splitter.Panel>
                <Splitter.Panel>
                    <OutputArea/>
                </Splitter.Panel>
            </Splitter>
        </ReplProvider>
        </ConfigProvider>
    )
}