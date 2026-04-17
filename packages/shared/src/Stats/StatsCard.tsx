"use client";

import { motion } from "framer-motion";
import React from "react";

export interface StatsCardProps {
  label: string;
  value: number | string;
  subtitle: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  delay?: number;
  isHighlight?: boolean;
  onClick?: () => void;
  trend?: {
    direction: "up" | "down" | "neutral";
    percentage: number;
  };
}

/**
 * Enhanced reusable stats card component with:
 * - Clickable filtering capability
 * - Trend indicators
 * - Consistent styling across all components
 * - Mobile responsive design
 */
export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  delay = 0,
  isHighlight = false,
  onClick,
  trend,
}) => {
  const containerClass = isHighlight
    ? "transform hover:scale-105 card bg-primary/10 shadow-lg hover:shadow-xl transition-all ring-1 ring-primary/20 group cursor-pointer"
    : onClick
      ? "transform hover:scale-105 card surface-card-hover group cursor-pointer transition-all hover:shadow-lg"
      : "transform hover:scale-105 card surface-card-hover group transition-all hover:shadow-lg";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000 }}
      onClick={onClick}
      className={containerClass}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div
        className="card-body relative overflow-hidden"
        style={{ padding: "var(--space-card-padding)" }}
      >
        {/* Background icon decoration */}
        <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
          <Icon className="h-full w-full" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Label with optional highlight badge */}
          <div className="mb-3 flex items-center justify-between">
            <span
              className={`text-sm font-semibold uppercase tracking-wider ${isHighlight ? "text-primary/70" : "text-muted"}`}
            >
              {label}
            </span>
            {trend && (
              <div
                className={`text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-full ${
                  trend.direction === "up"
                    ? "bg-success/20 text-success"
                    : trend.direction === "down"
                      ? "bg-error/20 text-error"
                      : "bg-base-300 text-base-content/60"
                }`}
              >
                <span>
                  {trend.direction === "up"
                    ? "↑"
                    : trend.direction === "down"
                      ? "↓"
                      : "→"}
                </span>
                <span>{Math.abs(trend.percentage)}%</span>
              </div>
            )}
          </div>

          {/* Value */}
          <p
            className={`text-4xl sm:text-5xl font-black mb-2 ${isHighlight ? "text-primary" : "text-base-content"}`}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>

          {/* Subtitle */}
          <p
            className={`text-sm sm:text-base font-semibold ${isHighlight ? "text-primary/60" : "text-muted"}`}
          >
            {subtitle}
          </p>

          {/* Click hint */}
          {onClick && (
            <div className="mt-3 text-xs text-base-content/50 opacity-0 group-hover:opacity-100 transition-opacity">
              Click to filter
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StatsCard;
