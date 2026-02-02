import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);

// Use contextBridge
window.api.on('main-process-message', (message) => {
  console.log('Received main-process-message:', message)
})

// в React-компоненте
// <script src="./renderer.js"></script>
// if (window.electronAPI.on) {
//   window.electronAPI.on("some-channel", (event, ...args) => {
//     console.log("Received:", args);
//   });
// }
