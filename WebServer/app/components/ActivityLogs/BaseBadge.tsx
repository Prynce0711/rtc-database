import React from "react";

// color must use daisyUI badge colors (primary, secondary, accent, info, success, warning, error) eg: <BaseBadge color="badge-primary" text="Primary" />
const BaseBadge = ({
  color,
  text,
  icon,
}: {
  color: string;
  text: string;
  icon?: React.ReactNode;
}) => {
  return (
    <span
      className={`badge ${color} gap-1.5 font-semibold text-xs px-3 py-2.5 whitespace-nowrap`}
    >
      {icon || (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      )}
      {text}
    </span>
  );
};

export default BaseBadge;
