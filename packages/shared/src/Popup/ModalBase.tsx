"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const ModalBase = ({
  children,
  className,
  onClose,
  notTransparent = false,
  bgColor = "bg-base-100",
}: {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  notTransparent?: boolean;
  bgColor?: string;
}) => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const canClose = typeof onClose === "function";
  const backdropPointerDown = useRef(false);

  const requestClose = () => {
    if (!canClose) return;
    setVisible(false);
  };

  const handleBackdropPointerDown = (event: ReactPointerEvent) => {
    backdropPointerDown.current = event.target === event.currentTarget;
  };

  const handleBackdropPointerUp = (event: ReactPointerEvent) => {
    const shouldClose =
      backdropPointerDown.current && event.target === event.currentTarget;
    backdropPointerDown.current = false;
    if (shouldClose) {
      requestClose();
    }
  };

  const handleBackdropPointerCancel = () => {
    backdropPointerDown.current = false;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  type ClickableChild = { onClick?: (event: ReactMouseEvent) => void };
  let childWithStop: ReactNode = children;

  if (isValidElement<ClickableChild>(children)) {
    const child = children as ReactElement<
      ClickableChild & { requestClose?: () => void }
    >;

    // Only add requestClose for custom components, not native HTML elements
    const isNativeElement = typeof child.type === "string";

    childWithStop = cloneElement(child, {
      onClick: (event: ReactMouseEvent) => {
        event.stopPropagation();
        child.props.onClick?.(event);
      },
      // provide a `requestClose` function to children so they can ask ModalBase
      // to perform the animated close sequence before calling the parent's onClose
      ...(!isNativeElement && { requestClose }),
    });
  }

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        if (onClose) onClose();
      }}
    >
      {visible && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.38, ease: "easeOut" }}
          className={`fixed inset-0 min-w-0 flex items-center justify-center z-9999 ${
            notTransparent ? `${bgColor}` : "bg-black/50"
          } ${className}`}
          onPointerDown={handleBackdropPointerDown}
          onPointerUp={handleBackdropPointerUp}
          onPointerCancel={handleBackdropPointerCancel}
        >
          <div className="max-h-100vh overflow-y-auto w-full items-center justify-center scrollbar-gutter-stable">
            <div className="flex-1 flex p-5 items-center justify-center">
              <motion.div
                key="modal-content"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.38, ease: "easeOut" }}
                onClick={(e: ReactMouseEvent) => e.stopPropagation()}
              >
                <div className="w-auto">{childWithStop}</div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default ModalBase;
