import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppBar, Toolbar, Typography } from '@mui/material';

import Repl from "./view/repl";

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
          <Route path={`/`} element={<Repl />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
