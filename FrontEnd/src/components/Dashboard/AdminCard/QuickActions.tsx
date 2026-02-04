import React from "react";
import { motion } from "framer-motion";

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

const QuickActions: React.FC<QuickActionsProps> = ({ actions }) => {
  return (
    <div className="bg-base-100 rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((action, index) => (
          <motion.button
            key={index}
            className="flex items-center gap-3 p-4 rounded-lg bg-base-200 hover:bg-base-300 transition-colors"
            onClick={action.onClick}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="shrink-0"
              whileHover={{ rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {action.icon}
            </motion.div>
            <div className="text-left">
              <div className="font-semibold text-base">{action.title}</div>
              <div className="text-sm opacity-60">{action.description}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
