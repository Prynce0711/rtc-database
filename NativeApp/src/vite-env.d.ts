/// <reference types="vite/client" />

interface BackendInfo {
  url: string;
  ip: string;
  port: number;
  lastSeen: number;
}

// Used in Renderer process, expose in `preload.ts`
declare global {
  interface Window {
    ipcRenderer?: import("electron").IpcRenderer & {
      onBackend: (callback: (backend: BackendInfo) => void) => void;
    };
  }
}

export {};
