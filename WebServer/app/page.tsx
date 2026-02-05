import Login from "./components/Login";

export default function Home() {
  return <Login />;
}

// const [currentView, setCurrentView] = useState<View>("login");
//   const [adminView, setAdminView] = useState<AdminView>("dashboard");

//   const handleAdminLogin = () => {
//     setCurrentView("admin");
//   };

//   const handleStaffLogin = () => {
//     setCurrentView("staff");
//   };

//   const handleLogout = () => {
//     setCurrentView("login");
//   };

//   return (
//     <>
//       {currentView === "login" && (
//         <>
//           <Login
//             onAdminLogin={handleAdminLogin}
//             onStaffLogin={handleStaffLogin}
//           />
//         </>
//       )}
//       {currentView === "admin" && (
//         <SidebarAdmin
//           onLogout={handleLogout}
//           activeView={adminView}
//           onNavigate={(view) => setAdminView(view as AdminView)}
//         >
//           {adminView === "dashboard" && (
//             <AdminDashboard
//               onNavigate={(view) => setAdminView(view as AdminView)}
//             />
//           )}
//           {adminView === "cases" && <AdminCases />}
//         </SidebarAdmin>
//       )}
//       {currentView === "staff" && (
//         <SidebarStaff onLogout={handleLogout}>
//           <StaffDashboard />
//         </SidebarStaff>
//       )}
//     </>
//   );