"use client";

import Link from "next/link";

const SidebarButton = ({
  activeView,
  href,
  icon,
}: {
  activeView: string;
  href: string;
  icon: React.ReactNode;
}) => {
  return (
    <li className="py-3">
      <Link
        href={`/user/${href}`}
        className={`is-drawer-close:tooltip is-drawer-close:tooltip-right ${
          activeView === href ? "active" : ""
        }`}
        data-tip={capitalizeFirstLetter(href)}
      >
        {/* Horizontal layout with gap and larger icon */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 text-2xl">
            {icon}
          </span>
          <span className="is-drawer-close:hidden text-sm font-medium">
            {capitalizeFirstLetter(href)}
          </span>
        </div>
      </Link>
    </li>
  );
};

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export default SidebarButton;
