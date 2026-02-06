/**
 * Quick Actions Component
 * 
 * Displays a grid of animated action buttons that provide quick access
 * to common tasks. Uses Framer Motion for smooth animations:
 * - Fade in on mount with staggered timing
 * - Scale up on hover
 * - Scale down on click
 * - Icon rotation on hover
 */

import React from "react";
import { motion } from "framer-motion";

/** Single quick action configuration */
interface QuickAction {
  /** Action button title */
  title: string;
  /** Descriptive text explaining what the action does */
  description: string;
  /** Icon element to display */
  icon: React.ReactNode;
  /** Click handler for the action */
  onClick: () => void;
  /** Optional button color class */
  color?: string;
}

/** Props for the QuickActions component */
interface QuickActionsProps {
  /** Array of quick actions to display */
  actions: QuickAction[];
}

const QuickActions: React.FC<QuickActionsProps> = ({ actions }) => {
  return (
    <div className="bg-base-100 rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
      {/* Responsive grid: 1 column on mobile, 2 columns on tablet+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Map through actions and create animated buttons */}
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
              <>{action.icon}</>
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
