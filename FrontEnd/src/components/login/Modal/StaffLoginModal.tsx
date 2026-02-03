import React, { useEffect } from "react";
import StaffLoginForm from "../Form/StaffLoginForm";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStaffLogin: () => void;
}

const StaffLoginModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onStaffLogin,
}) => {
  useEffect(() => {
    // nothing for now, keep placeholder if future focus handling needed
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="bg-base-100 rounded-lg shadow-xl p-6 z-10 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Staff Login</h3>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <StaffLoginForm
          onSuccess={() => {
            onStaffLogin();
            onClose();
          }}
        />
      </div>
    </div>
  );
};

export default StaffLoginModal;
