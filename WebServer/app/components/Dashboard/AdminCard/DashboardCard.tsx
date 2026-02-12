import React from "react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode; // ✅ OPTIONAL NA
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
      className={`bg-base-300 rounded-2xl shadow-lg border border-base-200 p-6 hover:shadow-xl transition-shadow text-center ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      {/* ICON (OPTIONAL) */}
      {icon && <div className={`mb-2 text-${color}`}>{icon}</div>}

      <p className="text-base font-bold mb-3">{title}</p>

      <p className={`text-5xl font-bold text-${color}`}>{value}</p>

      {trend && (
        <div
          className={`mt-2 text-sm ${
            trend.isPositive ? "text-success" : "text-error"
          }`}
        >
          {trend.isPositive ? "↗︎" : "↘︎"} {Math.abs(trend.value)}% from last
          month
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
