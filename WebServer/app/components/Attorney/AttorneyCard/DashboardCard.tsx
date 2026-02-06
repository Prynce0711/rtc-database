/**
 * Dashboard Card Component
 * 
 * Displays a statistic card with:
 * - Title and numeric value
 * - Icon representation
 * - Optional trend indicator (up/down percentage)
 * - Optional click handler for navigation
 * - Customizable color theme
 * 
 * Used in the attorney dashboard to show case statistics.
 */

import React from "react";

/** Props for the DashboardCard component */
interface DashboardCardProps {
  /** Card title text */
  title: string;
  /** Numeric or string value to display */
  value: string | number;
  /** Icon element to display */
  icon: React.ReactNode;
  /** Optional trend data showing change from previous period */
  trend?: {
    /** Percentage value of change */
    value: number;
    /** Whether the trend is positive (going up) */
    isPositive: boolean;
  };
  /** Color theme for the card (uses DaisyUI color classes) */
  color?:
    | "primary"
    | "secondary"
    | "accent"
    | "info"
    | "success"
    | "warning"
    | "error";
  /** Optional click handler - makes the card clickable */
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
