import { useEffect, useState } from "react";
import "./App.css";
import AdminDashboard from "./components/Dashboard/AdminDashboard";
import StaffDashboard from "./components/Dashboard/StaffDashboard";
import Footer from "./components/Footer";
import Login from "./components/Login";
import SidebarAdmin from "./components/Sidebar/SidebarAdmin";
import SidebarStaff from "./components/Sidebar/SidebarStaff";
import { AccountManagement } from "./components/AccountManagement";
import { setApiUrl } from "./lib/api";
import { BackendInfo } from "@rtc-database/shared";
import { AdminCases } from "./components/Case/AdminCase";
import { AnimatePresence, motion } from "framer-motion";
type View = "login" | "admin" | "staff";
type AdminView = "dashboard" | "cases" | "accounts";

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
    <AnimatePresence mode="wait">
      {currentView === "login" && (
        <motion.div
          key="login"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22 }}
        >
          <Login
            onAdminLogin={handleAdminLogin}
            onStaffLogin={handleStaffLogin}
          />
          <Footer />
        </motion.div>
      )}

      {currentView === "admin" && (
        <motion.div
          key="admin"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22 }}
        >
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
            {adminView === "accounts" && <AccountManagement />}
            <Footer />
          </SidebarAdmin>
        </motion.div>
      )}

      {currentView === "staff" && (
        <motion.div
          key="staff"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22 }}
        >
          <SidebarStaff onLogout={handleLogout}>
            <StaffDashboard />
            <Footer />
          </SidebarStaff>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
