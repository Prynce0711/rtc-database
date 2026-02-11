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
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all
        ${
          isActive
            ? "bg-primary text-primary-content shadow-md"
            : "text-base-content/70 hover:bg-base-300"
        }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
};

export default SidebarButton;
