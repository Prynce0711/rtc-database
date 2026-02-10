"use client";

import React from "react";

interface SuggestionsProps {
  suggestions: string[];
  onClick: (suggestion: string) => void;
}

const Suggestions: React.FC<SuggestionsProps> = ({ suggestions, onClick }) => {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="absolute z-10 w-full bg-base-100 border border-base-300 rounded mt-1 shadow-lg">
      {suggestions.map((suggestion, idx) => (
        <div
          key={idx}
          className="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm"
          onMouseDown={(e) => {
            // prevent blur before click
            e.preventDefault();
            onClick(suggestion);
          }}
        >
          {suggestion}
        </div>
      ))}
    </div>
  );
};

export default Suggestions;
