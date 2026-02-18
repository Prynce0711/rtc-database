"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiX,
} from "react-icons/fi";

type ModalVariant = "info" | "warning" | "error" | "success";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ModalVariant;
}

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
}: ConfirmModalProps) => {
  const variantConfig = {
    info: {
      icon: FiInfo,
      iconBg: "bg-info/10",
      iconColor: "text-info",
      btnClass: "btn-info",
    },
    warning: {
      icon: FiAlertTriangle,
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
      btnClass: "btn-warning",
    },
    error: {
      icon: FiAlertCircle,
      iconBg: "bg-error/10",
      iconColor: "text-error",
      btnClass: "btn-error",
    },
    success: {
      icon: FiCheckCircle,
      iconBg: "bg-success/10",
      iconColor: "text-success",
      btnClass: "btn-success",
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-base-300"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-base-300">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-6 h-6 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">{title}</h3>
                    <p className="text-sm text-base-content/70">{message}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="btn btn-ghost btn-sm btn-circle"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 flex gap-3">
                <button onClick={onClose} className="btn btn-ghost flex-1">
                  {cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`btn ${config.btnClass} flex-1`}
                >
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
