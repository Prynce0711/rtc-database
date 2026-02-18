export interface SidebarDropdownProps {
  href: string;
  label: string;
}

const SidebarDropdown = ({ href, label }: SidebarDropdownProps) => {
  return (
    <span className="flex items-center gap-3">
      <span className="h-1.5 w-1.5 rounded-full bg-base-content/40" />
      <span className="text-sm font-semibold tracking-wide text-base-content/80">
        {label}
      </span>
    </span>
  );
};

export default SidebarDropdown;
