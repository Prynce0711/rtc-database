"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { SettingsCard } from "../SettingsPrimitives";

const AppearanceTab = () => {
  const [theme, setTheme] = useState<string>(
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme") || "winter"
      : "winter",
  );

  const themes = [
    {
      value: "winter",
      label: "Light",
      desc: "Clean & professional",
      icon: "☀️",
    },
    { value: "dim", label: "Dark", desc: "Easy on the eyes", icon: "🌙" },
  ];

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Theme"
        description="Choose your preferred visual appearance."
      >
        <div className="px-7 py-5">
          <div className="grid grid-cols-2 gap-4">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setTheme(t.value);
                  document.documentElement.setAttribute("data-theme", t.value);
                }}
                className={[
                  "relative flex flex-col items-center gap-3 p-7 rounded-2xl border-2 transition-all duration-250",
                  theme === t.value
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-base-300/70 hover:border-base-content/15 bg-base-100 hover:shadow-sm",
                ].join(" ")}
              >
                <span className="text-3xl">{t.icon}</span>
                <span className="text-sm font-bold text-base-content">
                  {t.label}
                </span>
                <span className="text-[12px] text-base-content/35">
                  {t.desc}
                </span>
                {theme === t.value && (
                  <motion.div
                    layoutId="theme-check"
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm"
                  >
                    <svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                      className="text-primary-content"
                    >
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};

export default AppearanceTab;
