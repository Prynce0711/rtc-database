import { useEffect, useState } from "react";
import "./App.css";
import AdminDashboard from "./components/Dashboard/AdminDashboard";
import StaffDashboard from "./components/Dashboard/StaffDashboard";
import Footer from "./components/Footer";
import Login from "./components/Login";
import SidebarAdmin from "./components/Sidebar/SidebarAdmin";
import SidebarStaff from "./components/Sidebar/SidebarStaff";
import { setApiUrl } from "./lib/api";
import { BackendInfo } from "@rtc-database/shared";
import { AdminCases } from "./components/Case/AdminCase";
type View = "login" | "admin" | "staff";
type AdminView = "dashboard" | "cases";

function App() {
  const [currentView, setCurrentView] = useState<View>("login");
  const [adminView, setAdminView] = useState<AdminView>("dashboard");

  useEffect(() => {
    // Listen for backend URL updates from UDP
    if (window.ipcRenderer?.onBackend) {
      window.ipcRenderer.onBackend((backend: BackendInfo) => {
        setApiUrl(backend.url);
      });
    }
  }, []);

  const handleAdminLogin = () => {
    setCurrentView("admin");
  };

  const handleStaffLogin = () => {
    setCurrentView("staff");
  };

  const handleLogout = () => {
    setCurrentView("login");
  };

  return (
    <>
      {currentView === "login" && (
        <>
          <Login
            onAdminLogin={handleAdminLogin}
            onStaffLogin={handleStaffLogin}
          />
          <Footer />
        </>
      )}
      {currentView === "admin" && (
        <SidebarAdmin
          onLogout={handleLogout}
          activeView={adminView}
          onNavigate={(view) => setAdminView(view as AdminView)}
        >
          {adminView === "dashboard" && (
            <AdminDashboard
              onNavigate={(view) => setAdminView(view as AdminView)}
            />
          )}
          {adminView === "cases" && <AdminCases />}
          <Footer />
        </SidebarAdmin>
      )}
      {currentView === "staff" && (
        <SidebarStaff onLogout={handleLogout}>
          <StaffDashboard />
          <Footer />
        </SidebarStaff>
      )}
    </>
  );
}

export default App;
