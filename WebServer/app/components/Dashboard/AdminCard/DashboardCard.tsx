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
      className={`bg-base-300  rounded-2xl shadow-lg border border-base-200 p-6 hover:shadow-xl transition-shadow text-center ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <p className="text-base font-bold text-base mb-3">{title}</p>
      <p className="text-5xl font-bold text-primary">{value}</p>

      {trend && (
        <div
          className={`stat-desc ${trend.isPositive ? "text-success" : "text-error"}`}
        >
          {trend.isPositive ? "↗︎" : "↘︎"} {Math.abs(trend.value)}% from last
          month
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
