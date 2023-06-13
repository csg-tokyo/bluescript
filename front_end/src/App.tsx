import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppBar, Toolbar, Typography } from '@mui/material';

import Home from './pages/home';
import TsEditor from "./pages/ts-editor";
import Repl from "./pages/repl";

function App() {
  return (
    <div>
      <AppBar>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            BlueScript
          </Typography>
        </Toolbar>
      </AppBar>
      <BrowserRouter>
        <Routes>
          <Route path={`/`} element={<Home />} />
          <Route path={`/ts-editor`} element={<TsEditor />} />
          <Route path={`/repl`} element={<Repl />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
