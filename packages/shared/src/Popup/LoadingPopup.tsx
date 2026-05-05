"use client";

const LoadingPopup = ({ message }: { message?: string }) => {
  const displayMessage = message || "Please wait...";

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[1000] w-[min(calc(100vw-2rem),24rem)]"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto overflow-hidden rounded-lg border border-base-300 bg-base-100 text-base-content shadow-2xl">
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="loading loading-spinner loading-sm mt-1 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold">Processing</p>
              <p className="shrink-0 text-xs text-base-content/60">
                In progress
              </p>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-base-content/70">
              {displayMessage}
            </p>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden bg-base-300">
          <div className="h-full w-2/5 animate-[progress-slide_1.15s_ease-in-out_infinite] rounded-r-full bg-primary" />
        </div>
      </div>
      <style>{`
        @keyframes progress-slide {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(250%);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingPopup;
