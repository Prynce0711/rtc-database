"use client";

import { motion } from "framer-motion";
import React from "react";
import { FiSave } from "react-icons/fi";

export const SettingsCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    className="bg-base-100 rounded-2xl border border-base-300/80 overflow-hidden shadow-sm"
  >
    <div className="px-7 py-6 border-b border-base-300/60">
      <h3 className="text-xl font-bold text-base-content tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-base-content/45 mt-1 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="divide-y divide-base-200/60">{children}</div>
  </motion.div>
);

export const SettingsRow = ({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-6 px-7 py-5 group hover:bg-base-200/30 transition-colors duration-150">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-base-content">{label}</p>
      {description && (
        <p className="text-[13px] text-base-content/40 mt-0.5 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const Toggle = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={[
      "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-250 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
      checked ? "bg-primary shadow-sm" : "bg-base-300",
    ].join(" ")}
  >
    <span
      className={[
        "inline-block h-5 w-5 rounded-full bg-white shadow-md transition-all duration-250",
        checked ? "translate-x-6" : "translate-x-0.5",
      ].join(" ")}
    />
  </button>
);

export const SelectField = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="select select-bordered text-sm min-w-48 h-10 bg-base-100 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-lg"
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const InputField = ({
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    className="input input-bordered text-sm h-10 w-full max-w-72 bg-base-100 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:opacity-40 rounded-lg placeholder:text-base-content/25"
  />
);

export const SaveButton = ({ onClick }: { onClick?: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="btn btn-primary gap-2.5 text-sm font-semibold px-7 h-11 mt-8 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
  >
    <FiSave size={16} />
    Save Changes
  </motion.button>
);
