"use client";

import { useEffect, useState } from "react";
import "./App.css";

interface BackendInfo {
  url: string;
  ip: string;
  port: number;
  lastSeen: number;
}

export default function App() {
  const [status, setStatus] = useState<"locating" | "located" | "loading">(
    "locating",
  );
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [isDevMode] = useState(() => process.env.NODE_ENV === "development");

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
        if (
          typeof window !== "undefined" &&
          (window as any).ipcRenderer?.onBackend
        ) {
          (window as any).ipcRenderer.onBackend((backend: BackendInfo) => {
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
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center gap-6 animate-fade-in">
      {/* SPEEDER ANIMATION */}
      <div className="relative flex justify-center items-center h-56">
        <div className="transform scale-125">
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
        </div>
      </div>

      {/* LABEL */}
      <div className="text-center space-y-2">
        {status === "locating" && (
          <>
            <p className="text-xl font-semibold">Locating backend...</p>
            <p className="text-sm opacity-70">
              Listening for server broadcasts
            </p>
          </>
        )}

        {status === "located" && (
          <>
            <p className="text-xl font-semibold text-success">Backend found!</p>
            <p className="text-sm opacity-70">Preparing connection...</p>
          </>
        )}

        {status === "loading" && (
          <>
            <p className="text-xl font-semibold">Connecting to server...</p>
            <p className="text-sm opacity-70">Establishing secure connection</p>
          </>
        )}
      </div>
    </div>
  );
}
