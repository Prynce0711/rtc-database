import type { ReactNode } from "react";

export const formatLongDate = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const DetailField = ({
  label,
  value,
  mono = false,
  minHeightClass = "min-h-14.5",
}: {
  label: string;
  value: unknown;
  mono?: boolean;
  minHeightClass?: string;
}) => {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === "" ||
    value === "N/A" ||
    (typeof value === "string" && value.trim().toLowerCase() === "n/a");

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/30 select-none">
        {label}
      </span>
      <div
        className={[
          `px-5 py-4 rounded-xl border ${minHeightClass} flex items-center`,
          isEmpty
            ? "bg-base-200/40 border-base-200/60"
            : "bg-base-200/70 border-base-200",
        ].join(" ")}
      >
        <span
          className={[
            "leading-relaxed",
            isEmpty
              ? "text-[13px] italic text-base-content/25 font-normal"
              : mono
                ? "font-mono text-[13px] text-base-content/60"
                : "text-[15px] font-semibold text-base-content",
          ].join(" ")}
        >
          {isEmpty ? "—" : String(value)}
        </span>
      </div>
    </div>
  );
};

export const DetailSection = ({
  label,
  children,
  titleClassName = "text-[15px] font-bold uppercase tracking-[0.14em] text-base-content",
}: {
  label: string;
  children: ReactNode;
  titleClassName?: string;
}) => (
  <div className="space-y-5">
    <p className={titleClassName}>{label}</p>
    {children}
  </div>
);
