import React from "react";
import { FiMoreHorizontal } from "react-icons/fi";

const ActionDropdown = ({
  popoverId,
  anchorName,
  children,
  buttonClassName,
  menuClassName,
  iconSize = 18,
}: {
  popoverId: string;
  anchorName: string;
  children: React.ReactNode;
  buttonClassName?: string;
  menuClassName?: string;
  iconSize?: number;
}) => {
  return (
    <div className="flex justify-center">
      <button
        className={buttonClassName ?? "btn btn-ghost btn-sm px-2"}
        popoverTarget={popoverId}
        style={{ anchorName } as React.CSSProperties}
        aria-label="Open actions menu"
      >
        <FiMoreHorizontal size={iconSize} />
      </button>
      <ul
        popover="auto"
        id={popoverId}
        className={
          menuClassName ??
          "dropdown menu p-2 shadow-lg bg-base-100 rounded-box w-44 border border-base-200"
        }
        style={
          {
            positionAnchor: anchorName,
            inset: "auto",
            top: "anchor(bottom)",
            left: "anchor(start)",
            marginTop: "0.25rem",
            zIndex: 9999,
          } as React.CSSProperties
        }
      >
        {children}
      </ul>
    </div>
  );
};

export default ActionDropdown;
