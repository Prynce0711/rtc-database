/// <reference types="vite/client" />

interface BackendInfo {
  url: string;
  ip: string;
  port: number;
  lastSeen: number;
  relayFingerprint256?: string | null;
  relaySubjectName?: string | null;
  relayIssuerName?: string | null;
  pinnedRelayFingerprint256?: string | null;
  usualRelayHostname?: string | null;
  usualRelayProtocol?: "http" | "https" | null;
  usualRelayPort?: number | null;
  usualRelayReachable?: boolean | null;
  relayTrustState?: "trusted" | "new" | "changed" | "unverified";
  relayWarningKind?:
    | "certificate-changed"
    | "different-backend"
    | "unverified"
    | null;
  isPreferred?: boolean;
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
