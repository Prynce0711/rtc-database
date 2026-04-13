"use client";

import { useId, useState } from "react";
import { FaAngleDown } from "react-icons/fa6";

const Collapse = ({
  id,
  title,
  subtitle,
  defaultOpen = false,
  onToggle,
  headerActions,
  children,
}: {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  defaultOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  const generatedId = useId();
  const inputId = id || `collapse-${generatedId}`;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    onToggle?.(next);
  };

  return (
    <div className="rounded-xl border border-base-300/60 bg-base-100">
      <div className="flex items-start justify-between gap-2 px-4 py-3">
        <button
          type="button"
          id={inputId}
          onClick={handleToggle}
          className="min-w-0 flex-1 text-left"
          aria-expanded={isOpen}
          aria-controls={`${inputId}-content`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-base-content truncate">
              {title}
            </p>
            {subtitle ? (
              <div className="text-xs text-base-content/45 tracking-wide mt-0.5 break-all">
                {subtitle}
              </div>
            ) : null}
          </div>
        </button>

        <div className="flex items-center gap-1">
          {headerActions}
          <button
            type="button"
            onClick={handleToggle}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label={isOpen ? "Collapse section" : "Expand section"}
            aria-controls={`${inputId}-content`}
            aria-expanded={isOpen}
          >
            <FaAngleDown
              className={`transition-transform duration-200 ease-out ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <div
        id={`${inputId}-content`}
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-80"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-base-300/50 px-4 py-3 text-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Collapse;
