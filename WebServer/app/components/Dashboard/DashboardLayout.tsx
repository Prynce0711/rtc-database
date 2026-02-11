"use client";

import React from "react";

interface DashboardLayoutProps {
  title: string;
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
    <div className="min-h-screen bg-base-100">
      <main className={`w-full ${className}`}>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-base-content mb-2 text-4xl lg:text-5xl font-bold text-base-content mb-2">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xl text-base-content/70 ">{subtitle}</p>
          )}
        </div>

        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
