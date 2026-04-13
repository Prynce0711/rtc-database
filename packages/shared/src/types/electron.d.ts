declare global {
  interface Window {
    ipcRenderer?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}

export {};
