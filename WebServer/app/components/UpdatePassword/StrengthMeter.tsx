"use client";

import { motion } from "framer-motion";

const StrengthMeter = ({ strength }: { strength: number }) => {
  const strengthPercent = (strength / 4) * 100;
  const strengthLabel = ["Very Weak", "Weak", "Fair", "Good", "Strong"][
    strength
  ];

  return (
    <div>
      <div className="relative w-full h-2 bg-base-300 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${getStrengthColor(strength)} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${strengthPercent}%` }}
        />
      </div>

      <p className="text-xs mt-2 opacity-70">
        <span className="font-semibold">Strength:</span> {strengthLabel}
      </p>
    </div>
  );
};

const getStrengthColor = (strength: number) => {
  if (strength === 0) return "bg-error";
  if (strength <= 1) return "bg-warning";
  if (strength <= 3) return "bg-info";
  return "bg-success";
};

export default StrengthMeter;
