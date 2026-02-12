"use client";

import Link from "next/link";

const SidebarButton = ({
  icon,
  href,
  label,
  active,
}: {
  icon: React.ReactNode;
  href: string;
  label: string;
  active: string;
}) => {
  const isActive = active === href;

  return (
    <Link
      href={`/user/${href}`}
      className={`group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 ${
        isActive
          ? "bg-primary text-primary-content "
          : "text-base-content/70 hover:bg-base-300 hover:text-base-content hover:scale-[1.01]"
      }`}
    >
      <span
        className={`text-2xl transition-transform duration-200 ${
          isActive ? "" : "group-hover:scale-110"
        }`}
      >
        {icon}
      </span>
      <span className="text-base font-bold tracking-wide">{label}</span>

      {/* Active Indicator */}
      {isActive && (
        <div className="ml-auto">
          <div className="h-2 w-2 rounded-full bg-primary-content animate-pulse" />
        </div>
      )}
    </Link>
  );
};

export default SidebarButton;
