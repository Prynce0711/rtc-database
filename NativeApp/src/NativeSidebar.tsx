import { Sidebar } from "@rtc-database/shared";
import { useLocation } from "react-router-dom";

const NativeSidebar = ({ children }: { children?: React.ReactNode }) => {
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
      {children ? (
        children
      ) : (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Native App</h1>
          <p className="text-sm opacity-70">
            Current route: {location.pathname}
          </p>
        </div>
      )}
    </Sidebar>
  );
};

export default NativeSidebar;
