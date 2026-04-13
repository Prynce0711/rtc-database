export interface SidebarDropdownProps {
  href: string;
  label: string;
}

const SidebarDropdown = ({ label }: SidebarDropdownProps) => {
  return (
    <span className="flex items-center gap-3">
      <span className="h-px w-4 bg-base-content/25 flex-shrink-0" />
      <span className="text-sm font-medium text-base-content/60 group-hover:text-base-content/90 transition-colors">
        {label}
      </span>
    </span>
  );
};

export default SidebarDropdown;
