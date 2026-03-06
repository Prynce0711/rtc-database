"use client";

const NavButton = ({
  direction,
  label,
  sublabel,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled: boolean;
}) => {
  const isPrev = direction === "prev";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 min-w-0",
        disabled
          ? "opacity-25 cursor-not-allowed border-base-200 bg-transparent"
          : "border-base-200 bg-base-100 hover:bg-base-200/60 hover:border-base-content/15",
        isPrev ? "" : "flex-row-reverse",
      ].join(" ")}
    >
      {/* Chevron */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0 text-base-content/30 group-hover:text-base-content/60 transition-colors"
        aria-hidden="true"
      >
        {isPrev ? (
          <path
            d="M10 3L5 8L10 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M6 3L11 8L6 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {/* Text */}
      <div
        className={["min-w-0", isPrev ? "" : "items-end flex flex-col"].join(
          " ",
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/25 select-none leading-none mb-1">
          {isPrev ? "Previous" : "Next"}
        </p>
        <p className="text-[13px] font-bold text-base-content/60 group-hover:text-base-content truncate max-w-[200px] transition-colors leading-snug">
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-base-content/30 truncate max-w-[200px] leading-snug mt-0.5">
            {sublabel}
          </p>
        )}
      </div>
    </button>
  );
};

export default NavButton;
