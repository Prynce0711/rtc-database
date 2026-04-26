import { FiX } from "react-icons/fi";
import { AdaptiveLink } from "../lib/nextCompat";
import { ToastType } from "./ToastProvider";

const Toast = ({
  message,
  type = ToastType.INFO,
  onClose,
  href,
  title,
}: {
  message: string;
  type: ToastType;
  onClose?: () => void;
  href?: string;
  title?: string;
}) => {
  return (
    <div
      className={`alert ${type} pointer-events-auto shadow-lg min-w-72 max-w-md w-full flex items-start justify-between gap-2`}
      role="alert"
    >
      <div className="flex-1 pr-2">
        {title && <div className="text-sm font-bold mb-1">{title}</div>}
        <span className="text-sm font-medium">{message}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {href && (
          <AdaptiveLink href={href} className="btn btn-ghost btn-xs">
            Go
          </AdaptiveLink>
        )}
        {onClose && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onClose}
            aria-label="Close toast"
          >
            <FiX size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
