"use client";

import { AnimatePresence, motion } from "framer-motion";
import SpinningLoader from "./SpinningLoader";

const RedirectingUI = ({
  titleText = "Loading...",
  text = "",
}: {
  titleText?: string;
  text?: string;
}) => {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-base-100 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div
            className="mb-6 flex justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <SpinningLoader />
          </motion.div>

          <motion.p
            className="text-base font-medium mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {titleText}
          </motion.p>

          <motion.p
            className="text-sm opacity-60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {text}
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RedirectingUI;
