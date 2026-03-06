"use client";

import React from "react";
import { FiCornerDownLeft } from "react-icons/fi";

interface SuggestionsProps {
  suggestions: string[];
  onClick: (suggestion: string) => void;
}

const Suggestions: React.FC<SuggestionsProps> = ({ suggestions, onClick }) => {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="absolute z-20 w-full mt-1.5 bg-base-100 border border-base-300/80 rounded-xl shadow-(--shadow-md) overflow-hidden max-h-56 overflow-y-auto">
      <div className="px-3 py-1.5 border-b border-base-200 bg-base-200/40">
        <span className="text-[10px] font-medium uppercase tracking-wider text-base-content/40">
          Suggestions
        </span>
      </div>
      {suggestions.map((suggestion, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-primary/5 cursor-pointer transition-colors duration-100 group border-b border-base-200/50 last:border-b-0"
          onMouseDown={(e) => {
            e.preventDefault();
            onClick(suggestion);
          }}
        >
          <span className="text-sm text-base-content/80 group-hover:text-base-content truncate">
            {suggestion}
          </span>
          <FiCornerDownLeft className="w-3 h-3 text-base-content/20 group-hover:text-primary/50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      ))}
    </div>
  );
};

export default Suggestions;
