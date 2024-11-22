import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from 'antd';
import Home from "./view/home";
import { Typography } from 'antd';
import ThemeProvider, { ThemeContext } from "./hooks/theme-context";
import { useContext } from "react";

function App() {
  const theme = useContext(ThemeContext)

  return (
    <ThemeProvider>
      <Layout style={{minHeight: "100vh"}}>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40, backgroundColor: theme.background.black, paddingLeft:10}} >
            <Typography.Title level={5} style={{margin:0, fontSize:16, color: theme.text.white}}>BlueScript</Typography.Title>
              {/* <Switch
                checkedChildren={<SunFilled />}
                unCheckedChildren={<MoonFilled />}
                defaultChecked
                onChange={theme.setIsDark}
              /> */}
        </Layout.Header>
        <Layout.Content style={{ display: 'flex', alignItems: 'center', height: 48, background:theme.background.white}}>
          <BrowserRouter>
            <Routes>
              <Route path={`/`} element={<Home />} />
            </Routes>
          </BrowserRouter>
        </Layout.Content>
      </Layout>
    </ThemeProvider>
  );
}

export default App;
