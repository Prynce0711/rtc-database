"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Toast from "./Toast";

export enum ToastType {
  INFO = "alert-info",
  SUCCESS = "alert-success",
  WARNING = "alert-warning",
  ERROR = "alert-error",
}

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  href?: string;
  title?: string;
};

type ToastContextType = {
  showToast: (
    message: string,
    type?: ToastType,
    duration?: number,
    href?: string,
    title?: string,
  ) => string;
  info: (
    message: string,
    duration?: number,
    href?: string,
    title?: string,
  ) => string;
  success: (
    message: string,
    duration?: number,
    href?: string,
    title?: string,
  ) => string;
  warning: (
    message: string,
    duration?: number,
    href?: string,
    title?: string,
  ) => string;
  error: (
    message: string,
    duration?: number,
    href?: string,
    title?: string,
  ) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const createToastId = (): string => {
  if (typeof globalThis !== "undefined") {
    const cryptoApi = globalThis.crypto as Crypto | undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }
  }

  return `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = ToastType.INFO,
      duration = 4000,
      href?: string,
      title?: string,
    ) => {
      const id = createToastId();
      setToasts((prev) => [
        ...prev,
        { id, message, type, duration, href, title },
      ]);
      return id;
    },
    [],
  );

  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    toasts.forEach((toast) => {
      if (timersRef.current.has(toast.id)) return;

      const timer = setTimeout(() => {
        dismissToast(toast.id);
      }, toast.duration);

      timersRef.current.set(toast.id, timer);
    });
  }, [toasts, dismissToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value: ToastContextType = {
    showToast,
    info: (message, duration, href, title) =>
      showToast(message, ToastType.INFO, duration, href, title),
    success: (message, duration, href, title) =>
      showToast(message, ToastType.SUCCESS, duration, href, title),
    warning: (message, duration, href, title) =>
      showToast(message, ToastType.WARNING, duration, href, title),
    error: (message, duration, href, title) =>
      showToast(message, ToastType.ERROR, duration, href, title),
    dismissToast,
    clearToasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="fixed bottom-4 right-4 z-10000 flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 24, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Toast
                type={toast.type}
                message={toast.message}
                onClose={() => dismissToast(toast.id)}
                href={toast.href}
                title={toast.title}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
