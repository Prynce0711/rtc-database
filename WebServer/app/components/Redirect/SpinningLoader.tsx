"use client";

import { motion } from "framer-motion";

const SpinningLoader = () => {
  const bars = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="relative w-14 h-14">
      {bars.map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-[30%] w-[8%] h-[24%] bg-base-content rounded-full shadow-sm"
          style={{
            transform: `rotate(${i * 30}deg) translate(0, -130%)`,
            transformOrigin: "0% 0%",
          }}
          animate={{
            opacity: [1, 0.25],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
            delay: -1.1 + i * 0.1,
          }}
        />
      ))}
    </div>
  );
};

export default SpinningLoader;
