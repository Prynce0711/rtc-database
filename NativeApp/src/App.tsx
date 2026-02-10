import { useEffect, useState } from "react";
import "./App.css";

interface BackendInfo {
  url: string;
  ip: string;
  port: number;
  lastSeen: number;
}

function App() {
  const [status, setStatus] = useState<"locating" | "located" | "loading">(
    "locating",
  );
  const [backendUrl, setBackendUrl] = useState<string | null>(null);

  useEffect(() => {
    // Listen for backend discovery from main process
    if (window.ipcRenderer?.onBackend) {
      window.ipcRenderer.onBackend((backend: BackendInfo) => {
        console.log("✅ Backend discovered:", backend);
        setBackendUrl(backend.url);
        setStatus("located");

        // After showing the backend info for 2 seconds, load it
        setTimeout(() => {
          setStatus("loading");
          // Navigate to the backend URL
          window.location.href = backend.url;
        }, 2000);
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-primary via-secondary to-accent flex items-center justify-center p-8">
      <div className="card bg-base-100 shadow-2xl max-w-md w-full">
        <div className="card-body items-center text-center gap-6">
          {status === "locating" && (
            <>
              <div className="relative">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <div className="absolute inset-0 flex items-center justify-center text-4xl animate-pulse">
                  🔍
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="card-title text-3xl font-bold">
                  Locating Backend
                </h1>
                <div className="flex items-center gap-2 text-base-content/70">
                  <span className="loading loading-dots loading-sm"></span>
                  <p>Listening for server broadcasts</p>
                </div>
              </div>
              <div className="alert alert-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span className="text-sm">
                  Multicast discovery active on port 41234
                </span>
              </div>
            </>
          )}

          {status === "located" && backendUrl && (
            <>
              <div className="text-6xl animate-bounce">✅</div>
              <div className="space-y-3">
                <h1 className="card-title text-3xl font-bold text-success">
                  Backend Located!
                </h1>
                <div className="badge badge-success badge-lg gap-2 px-4 py-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="inline-block w-4 h-4 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  Connected
                </div>
              </div>
              <div className="mockup-code w-full bg-neutral text-neutral-content">
                <pre className="px-6">
                  <code className="text-sm">{backendUrl}</code>
                </pre>
              </div>
              <div className="flex items-center gap-2">
                <span className="loading loading-ring loading-md"></span>
                <p className="text-sm opacity-70">Loading in 2 seconds...</p>
              </div>
              <progress
                className="progress progress-success w-full"
                value="100"
                max="100"
              ></progress>
            </>
          )}

          {status === "loading" && (
            <>
              <span className="loading loading-infinity loading-lg text-primary"></span>
              <div className="space-y-3">
                <h1 className="card-title text-3xl font-bold">
                  Loading Backend
                </h1>
                <p className="text-base-content/70">Connecting to server...</p>
              </div>
              <progress className="progress progress-primary w-full"></progress>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
