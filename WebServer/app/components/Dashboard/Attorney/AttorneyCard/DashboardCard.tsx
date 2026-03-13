import React from "react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?:
    | "primary"
    | "secondary"
    | "accent"
    | "info"
    | "success"
    | "warning"
    | "error";
  onClick?: () => void;
}

/* ✅ Tailwind SAFE Color Mapping */
const colorClasses = {
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon,
  trend,
  color = "primary",
  onClick,
}) => {
  return (
    <div
      className={`stat bg-base-100 rounded-lg shadow hover:shadow-lg transition-shadow ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      {/* ICON */}
      <div className={`stat-figure ${colorClasses[color]}`}>{icon}</div>

      {/* TITLE */}
      <div className="stat-title">{title}</div>

      {/* VALUE */}
      <div className={`stat-value ${colorClasses[color]}`}>{value}</div>

      {/* TREND */}
      {trend && (
        <div
          className={`stat-desc ${
            trend.isPositive ? "text-success" : "text-error"
          }`}
        >
          {trend.isPositive ? "↗︎" : "↘︎"} {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
