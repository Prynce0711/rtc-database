import { FiX } from "react-icons/fi";
import { AdaptiveLink } from "../lib/nextCompat";
import { ToastType } from "./ToastProvider";

const Toast = ({
  message,
  type = ToastType.INFO,
  onClose,
  href,
}: {
  message: string;
  type: ToastType;
  onClose?: () => void;
  href?: string;
}) => {
  return (
    <div
      className={`alert ${type} pointer-events-auto shadow-lg min-w-72 max-w-md w-full flex items-start justify-between gap-2`}
      role="alert"
    >
      <span className="text-sm font-medium pr-2 flex-1">{message}</span>
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
