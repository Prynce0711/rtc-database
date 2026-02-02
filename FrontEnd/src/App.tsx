import "./App.css";
import { useState } from "react";
import Login from "./assets/components/login";
import AdminDashboard from "./assets/components/Dashboard/AdminDashboard";
import StaffDashboard from "./assets/components/Dashboard/StaffDashboard";

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
        <Login
          onAdminLogin={handleAdminLogin}
          onStaffLogin={handleStaffLogin}
        />
      )}
      {currentView === "admin" && <AdminDashboard onLogout={handleLogout} />}
      {currentView === "staff" && <StaffDashboard onLogout={handleLogout} />}
    </>
  );
}

export default App;
