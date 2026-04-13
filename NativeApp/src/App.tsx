"use client";

import { Sidebar } from "@rtc-database/shared";
import { useEffect } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import "./App.css";

const NativeSidebarShell = () => {
  const location = useLocation();

  return (
    <Sidebar
      session={{
        user: {
          name: "Native User",
          role: "admin",
        },
      }}
      updateDarkMode={(newTheme) => {
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", newTheme);
        }
        return { success: true };
      }}
      onSignOut={() => {
        if (typeof window !== "undefined") {
          window.location.hash = "#/login";
        }
      }}
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Native App</h1>
        <p className="text-sm opacity-70">Current route: {location.pathname}</p>
      </div>
    </Sidebar>
  );
};

export default function App() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const currentTheme = document.documentElement.getAttribute("data-theme");
    if (currentTheme !== "winter" && currentTheme !== "dim") {
      document.documentElement.setAttribute("data-theme", "winter");
    }
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/user/dashboard" replace />} />
        <Route
          path="/login"
          element={<Navigate to="/user/dashboard" replace />}
        />
        <Route path="/user/*" element={<NativeSidebarShell />} />
        <Route path="*" element={<Navigate to="/user/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
