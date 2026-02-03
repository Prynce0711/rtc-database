import "./App.css";
import { useState } from "react";
import Footer from "./assets/components/Footer";
import Login from "./assets/components/Login";
import AdminDashboard from "./assets/components/Dashboard/AdminDashboard";
import StaffDashboard from "./assets/components/Dashboard/StaffDashboard";
import SidebarStaff from "./assets/components/Sidebar/SidebarStaff";
import SidebarAdmin from "./assets/components/Sidebar/SidebarAdmin";
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
