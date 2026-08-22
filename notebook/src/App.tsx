import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from 'antd';
import Home from "./view/home";
import { Typography } from 'antd';

function App() {

  return (
    <Layout style={{height: "100vh"}}>
      <Layout.Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40, backgroundColor: '#434343', paddingLeft:10}} >
          <Typography.Title level={5} style={{margin:0, fontSize:16, color: '#ffffff'}}>BlueScript</Typography.Title>
      </Layout.Header>
      <Layout.Content style={{ flex: 1, minHeight: 0, height: 'calc(100vh - 40px)', overflow: 'hidden', background:'#ffffff'}}>
        <BrowserRouter>
          <Routes>
            <Route path={`/`} element={<Home />} />
          </Routes>
        </BrowserRouter>
      </Layout.Content>
    </Layout>
  );
}

export default App;
