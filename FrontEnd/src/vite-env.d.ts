/// <reference types="vite/client" />

// Used in Renderer process, expose in `preload.ts`
declare global {
  interface Window {
    ipcRenderer?: import("electron").IpcRenderer & {
      onBackend: (callback: (backend: BackendInfo) => void) => void;
    };
  }
}

export {};
