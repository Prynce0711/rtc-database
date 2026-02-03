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
type View = "login" | "admin" | "staff";

function App() {
  const [currentView, setCurrentView] = useState<View>("login");

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
        <SidebarAdmin onLogout={handleLogout}>
          <AdminDashboard />
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
