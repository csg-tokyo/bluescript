import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from 'antd';
import Home from "./view2/home";
import { Typography } from 'antd';
import { gray } from '@ant-design/colors';

function App() {
  return (
      <Layout style={{minHeight: "100vh"}}>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', height: 40, backgroundColor: gray[6], paddingLeft:10}} >
            <Typography.Title level={5} style={{margin:0, fontSize:16, color: 'white'}}>BlueScript</Typography.Title>
        </Layout.Header>
        <Layout.Content style={{ display: 'flex', alignItems: 'center', height: 48, background:'white'}}>
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
