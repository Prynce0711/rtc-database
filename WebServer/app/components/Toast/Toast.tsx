import { FiX } from "react-icons/fi";
import { ToastType } from "./ToastProvider";

const Toast = ({
  message,
  type = ToastType.INFO,
  onClose,
}: {
  message: string;
  type: ToastType;
  onClose?: () => void;
}) => {
  return (
    <div
      className={`alert ${type} pointer-events-auto shadow-lg min-w-72 max-w-md w-full flex items-start justify-between gap-2`}
      role="alert"
    >
      <span className="text-sm font-medium pr-2 flex-1">{message}</span>
      {onClose && (
        <button
          type="button"
          className="btn btn-ghost btn-xs shrink-0 ml-auto"
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
