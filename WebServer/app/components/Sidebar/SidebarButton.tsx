"use client";

import Link from "next/link";
import SidebarDropdown, { SidebarDropdownProps } from "./SidebarDropdown";

const SidebarButton = ({
  icon,
  href,
  label,
  active,
  dropdowns,
}: {
  icon: React.ReactNode;
  href: string;
  label: string;
  active: string;
  dropdowns?: SidebarDropdownProps[];
}) => {
  const isActive = active === href;

  return (
    <div className="flex flex-col">
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

      {isActive && dropdowns && dropdowns.length > 0 && (
        <div className="mt-1 ml-10 space-y-1">
          {dropdowns.map((dropdown) => (
            <Link
              key={dropdown.href}
              href={`/user/${href}/${dropdown.href}`}
              className="flex items-center rounded-xl px-4 py-2 transition hover:bg-base-300"
            >
              <SidebarDropdown {...dropdown} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default SidebarButton;
