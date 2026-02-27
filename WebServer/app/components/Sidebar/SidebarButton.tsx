"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
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
  const pathname = usePathname();
  const isActive = active === href || pathname.startsWith(`/user/${href}`);
  const currentSub = pathname.split("/")[3] || "";

  const [open, setOpen] = React.useState(false);
  const isParentOnly = dropdowns && dropdowns.length > 0;

  React.useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <div className="flex flex-col">
      {isParentOnly ? (
        <button
          onClick={() => setOpen((prev) => !prev)}
          className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl w-full text-left transition-all duration-150 ${
            isActive
              ? "bg-primary text-primary-content shadow-sm"
              : "text-base-content/60 hover:bg-base-300/60 hover:text-base-content"
          }`}
        >
          <span className="text-lg flex-shrink-0">{icon}</span>

          <span className="text-sm font-semibold tracking-wide flex-1 text-left">
            {label}
          </span>

          {open ? null : null}
        </button>
      ) : (
        <Link
          href={`/user/${href}`}
          className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150 ${
            isActive
              ? "bg-primary text-primary-content shadow-sm"
              : "text-base-content/60 hover:bg-base-300/60 hover:text-base-content"
          }`}
        >
          <span className="text-lg flex-shrink-0">{icon}</span>

          <span className="text-sm font-semibold tracking-wide flex-1">
            {label}
          </span>

          {isActive && (
            <div className="h-1.5 w-1.5 rounded-full bg-primary-content/70 flex-shrink-0" />
          )}
        </Link>
      )}

      {open && dropdowns && dropdowns.length > 0 && (
        <div className="mt-0.5 ml-4 pl-3 border-l border-base-300 space-y-0.5 py-1">
          {dropdowns.map((dropdown) => (
            <Link
              key={dropdown.href}
              href={`/user/${href}${dropdown.href ? `/${dropdown.href}` : ""}`}
              className={`group flex items-center rounded-lg px-3 py-2 transition-all duration-150 ${
                currentSub === dropdown.href
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-base-300/50"
              }`}
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
