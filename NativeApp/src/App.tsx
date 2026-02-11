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
  const [isDevMode] = useState(() => import.meta.env.DEV);

  useEffect(() => {
    let isSubscribed = true;

    // Try localhost:3000 first in dev mode
    const tryLocalhost = async () => {
      if (!isDevMode) return false;

      console.log("🔍 Dev mode detected, checking localhost:3000...");

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch("http://localhost:3000/api/health", {
          signal: controller.signal,
          method: "GET",
        });

        console.log("Received response from localhost:3000:", response.status);

        clearTimeout(timeoutId);

        if (response.ok) {
          const text = await response.text();
          if (text === "OK" && isSubscribed) {
            console.log("✅ Localhost:3000 is available!");
            setBackendUrl("http://localhost:3000");
            setStatus("located");

            setTimeout(() => {
              if (isSubscribed) {
                setStatus("loading");
                window.location.href = "http://localhost:3000";
              }
            }, 2000);

            return true;
          }
        }
      } catch (err) {
        console.log(
          "❌ Localhost:3000 not available, falling back to UDP discovery",
        );
      }

      return false;
    };

    // Start with localhost check in dev mode, then fall back to UDP
    (async () => {
      const localhostWorked = await tryLocalhost();

      if (!localhostWorked && isSubscribed) {
        // Listen for backend discovery from main process
        if (window.ipcRenderer?.onBackend) {
          window.ipcRenderer.onBackend((backend: BackendInfo) => {
            if (!isSubscribed) return;

            console.log("✅ Backend discovered:", backend);
            setBackendUrl(backend.url);
            setStatus("located");

            // After showing the backend info for 2 seconds, load it
            setTimeout(() => {
              if (isSubscribed) {
                setStatus("loading");
                // Navigate to the backend URL
                window.location.href = backend.url;
              }
            }, 2000);
          });
        }
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [isDevMode]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center text-center gap-6">
          {status === "locating" && (
            <>
              <div className="relative h-[200px] w-full">
                <div className="loader">
                  <span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  <div className="base">
                    <span></span>
                    <div className="face"></div>
                  </div>
                </div>
                <div className="longfazers">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  Locating Backend
                </h1>
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <p>Listening for server broadcasts</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 w-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-blue-600 shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span className="text-sm text-blue-800 text-left">
                  {isDevMode
                    ? "Checked localhost:3000, now listening for broadcasts"
                    : "Broadcast discovery active on port 41234"}
                </span>
              </div>
            </>
          )}

          {status === "located" && backendUrl && (
            <>
              <div className="relative h-[200px] w-full">
                <div className="loader">
                  <span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  <div className="base">
                    <span></span>
                    <div className="face"></div>
                  </div>
                </div>
                <div className="longfazers">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-green-600">
                  Backend Located!
                </h1>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="inline-block w-4 h-4 stroke-green-700 stroke-2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <span className="font-semibold text-green-700">
                    Connected
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-900 text-gray-100 rounded-lg p-4">
                <pre className="text-sm font-mono overflow-x-auto">
                  <code>{backendUrl}</code>
                </pre>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
                <p className="text-sm text-gray-600">Loading in 2 seconds...</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="bg-green-500 h-full w-full"></div>
              </div>
            </>
          )}

          {status === "loading" && (
            <>
              <div className="relative h-[200px] w-full">
                <div className="loader">
                  <span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  <div className="base">
                    <span></span>
                    <div className="face"></div>
                  </div>
                </div>
                <div className="longfazers">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  Loading Backend
                </h1>
                <p className="text-gray-600">Connecting to server...</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-500 h-full w-full animate-pulse"></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
