"use client";

import React from "react";

/**
 * Button style presets for consistent UI/UX across components
 */
export const ButtonStyles = {
  // Primary actions (Add, Create, Save)
  primary: "btn btn-success btn-md gap-2",
  primaryOutline: "btn btn-outline btn-success btn-md gap-2",

  // Secondary actions (Filter, Search, More options)
  secondary: "btn btn-outline btn-md gap-2",
  secondaryGhost: "btn btn-ghost btn-md gap-2",

  // Negative actions (Delete, Remove)
  danger: "btn btn-error btn-md gap-2",
  dangerGhost: "btn btn-ghost btn-md gap-2",

  // Info/Status (Import, Export, Refresh)
  info: "btn btn-outline btn-info btn-md gap-2",

  // Small buttons (Row actions, inline)
  small: "btn btn-sm gap-2",
  smallGhost: "btn btn-sm btn-ghost gap-2",
  smallOutline: "btn btn-sm btn-outline gap-2",

  // Icon-only buttons
  icon: "btn btn-ghost btn-circle",
  iconSmall: "btn btn-sm btn-ghost btn-circle",
};

interface ButtonGroupProps {
  gap?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
}

/**
 * Consistent button group container
 */
export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  gap = "md",
  children,
  className = "",
}) => {
  const gapClass = {
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
  }[gap];

  return (
    <div className={`flex items-center flex-wrap ${gapClass} ${className}`}>
      {children}
    </div>
  );
};

interface ToolbarButtonsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Toolbar button container for header actions
 */
export const ToolbarButtons: React.FC<ToolbarButtonsProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className={`flex gap-2 flex-wrap items-center ${className}`}>
      {children}
    </div>
  );
};

interface ActionButtonProps {
  variant: "primary" | "secondary" | "danger" | "info";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
}

/**
 * Enhanced action button with consistent styling
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  variant,
  size = "md",
  icon,
  children,
  loading = false,
  disabled = false,
  onClick,
  className = "",
  type = "button",
}) => {
  const baseStyles = {
    primary: ButtonStyles.primary,
    secondary: ButtonStyles.secondary,
    danger: ButtonStyles.danger,
    info: ButtonStyles.info,
  };

  const sizeStyles = {
    sm: "btn-sm",
    md: "",
    lg: "btn-lg",
  };

  return (
    <button
      type={type}
      className={`${baseStyles[variant]} ${sizeStyles[size]} ${loading ? "loading" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {icon && !loading && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};

export default ButtonStyles;
