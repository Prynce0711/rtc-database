"use client";

import { motion } from "framer-motion";

const RequirementUI = ({ ok, text }: { ok: boolean; text: string }) => (
  <motion.p
    className={`flex items-center gap-2 transition-colors duration-300 ${
      ok ? "text-success" : "opacity-60"
    }`}
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3 }}
  >
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
    >
      {ok ? "✔" : "•"}
    </motion.span>
    {text}
  </motion.p>
);

export default RequirementUI;
