import React, { useState } from "react";
import StaffLoginModal from "./Modal/StaffLoginModal";
import AdminLoginForm from "./Form/AdminLoginForm";

interface LoginProps {
  onAdminLogin: () => void;
  onStaffLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onAdminLogin, onStaffLogin }) => {
  const [showAdminForm, setShowAdminForm] = useState<boolean>(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start md:justify-center gap-4">
            <img
              src="/SupremeCourtLogo.webp"
              alt="Supreme Court of the Philippines"
              className="w-28 h-28 md:w-32 md:h-32 object-contain"
            />

            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold text-base-content mb-2">
                Regional Trial Court
              </h1>
              <p className="text-lg text-base-content font-semibold">
                Republic of the Philippines
              </p>
              <p className="text-sm opacity-70 italic mt-1">"Batas at Bayan"</p>
            </div>
          </div>
        </div>

        <div className="bg-base-100 rounded-lg shadow-xl p-8 border-t-4 border-primary">
          {!showAdminForm ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-base-content mb-4 text-center">
                Continue as
              </h2>

              <button
                className="btn btn-primary w-full text-lg"
                onClick={() => setShowAdminForm(true)}
              >
                Login as Admin
              </button>

              <div className="divider">OR</div>

              <button
                className="btn btn-outline btn-primary w-full text-lg"
                onClick={() => setIsStaffModalOpen(true)}
              >
                Login as Staff
              </button>
            </div>
          ) : (
            <AdminLoginForm
              onSuccess={onAdminLogin}
              onBack={() => setShowAdminForm(false)}
            />
          )}
        </div>
      </div>

      <StaffLoginModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        onStaffLogin={() => {
          setIsStaffModalOpen(false);
          onStaffLogin();
        }}
      />
    </div>
  );
};

export default Login;
