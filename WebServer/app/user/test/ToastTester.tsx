import { useToast } from "@rtc-database/shared";

const ToastTester = () => {
  const toast = useToast();

  return (
    <div className="flex-1 p-6 space-y-4">
      <p className="text-lg font-semibold">Toast Test Page</p>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-info"
          onClick={() => toast.info("This is an info toast.")}
        >
          Info Toast
        </button>
        <button
          className="btn btn-success"
          onClick={() => toast.success("This is a success toast.")}
        >
          Success Toast
        </button>
        <button
          className="btn btn-warning"
          onClick={() => toast.warning("This is a warning toast.")}
        >
          Warning Toast
        </button>
        <button
          className="btn btn-error"
          onClick={() => toast.error("This is an error toast.")}
        >
          Error Toast
        </button>
      </div>
    </div>
  );
};

export default ToastTester;
