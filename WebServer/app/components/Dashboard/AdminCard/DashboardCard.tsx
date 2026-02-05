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
      className={`stat bg-base-100 rounded-lg shadow hover:shadow-lg transition-shadow ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="stat-figure text-${color}">{icon}</div>
      <div className="stat-title">{title}</div>
      <div className={`stat-value text-${color}`}>{value}</div>
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
