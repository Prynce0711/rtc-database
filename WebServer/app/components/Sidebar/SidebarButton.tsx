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
    <li className="py-1">
      <Link
        href={`/user/${href}`}
        className={`is-drawer-close:tooltip is-drawer-close:tooltip-right ${
          activeView === href ? "active" : ""
        }`}
        data-tip={capitalizeFirstLetter(href)}
      >
        {/* Home icon */}
        {icon}
        <span className="is-drawer-close:hidden">
          {capitalizeFirstLetter(href)}
        </span>
      </Link>
    </li>
  );
};

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export default SidebarButton;
