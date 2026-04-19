/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string;
    /** /dist/ or /public/ */
    VITE_PUBLIC: string;
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import("electron").IpcRenderer & {
    onBackend: (callback: (backend: BackendInfo) => void) => void;
  };
}

declare module "*?nodeWorker" {
  import type { Worker, WorkerOptions } from "node:worker_threads";

  const createWorker: (options?: WorkerOptions) => Worker;
  export default createWorker;
}

declare module "*?modulePath" {
  const modulePath: string;
  export default modulePath;
}
