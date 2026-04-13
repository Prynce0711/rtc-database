"use client";

import React from "react";

export interface DashboardLayoutProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  title,
  subtitle,
  children,
  className = "",
}) => {
  return (
    <div className="min-h-screen ">
      <main
        className={`w-full max-w-[1600px] mx-auto ${className}`}
        style={{ padding: "var(--space-page-y) var(--space-page-x)" }}
      >
        {title && (
          <div className="mb-6">
            <h2 className="text-3xl lg:text-4xl font-bold text-base-content tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-base text-muted">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
