import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Use contextBridge when running in Electron; skip in plain browser/dev contexts.
if (window.ipcRenderer?.on) {
  window.ipcRenderer.on("main-process-message", (_event, message) => {
    console.log(message);
  });
}
