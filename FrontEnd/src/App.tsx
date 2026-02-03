import "./App.css";
import { useState } from "react";
import Footer from "./components/Footer";
import Login from "./components/login/Login";
import AdminDashboard from "./components/Dashboard/AdminDashboard";
import StaffDashboard from "./components/Dashboard/StaffDashboard";
import SidebarStaff from "./components/Sidebar/SidebarStaff";
import SidebarAdmin from "./components/Sidebar/SidebarAdmin";
type View = "login" | "admin" | "staff";

function App() {
  const [currentView, setCurrentView] = useState<View>("login");

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
