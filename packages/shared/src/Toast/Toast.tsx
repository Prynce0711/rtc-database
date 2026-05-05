import { FiX } from "react-icons/fi";
import { AdaptiveLink } from "../lib/nextCompat";
import { ToastType } from "./ToastProvider";

const Toast = ({
  message,
  type = ToastType.INFO,
  onClose,
  href,
  title,
  actionLabel,
  onAction,
}: {
  message: string;
  type: ToastType;
  onClose?: () => void;
  href?: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
}) => {
  return (
    <div
      className={`alert ${type} pointer-events-auto relative shadow-lg min-w-72 max-w-md w-full flex items-start gap-3 pr-10`}
      role="alert"
    >
      <div className="flex-1">
        {title && <div className="text-sm font-bold mb-1">{title}</div>}
        <span className="text-sm font-medium">{message}</span>
        {(href || onAction) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onAction && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={onAction}
              >
                {actionLabel || "Open"}
              </button>
            )}
            {href && (
              <AdaptiveLink href={href} className="btn btn-ghost btn-xs">
                Go
              </AdaptiveLink>
            )}
          </div>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-circle absolute right-2 top-2"
          onClick={onClose}
          aria-label="Close toast"
        >
          <FiX size={14} />
        </button>
      )}
    </div>
  );
};

export default Toast;
