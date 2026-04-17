"use client";

import React from "react";
import { FiPlus } from "react-icons/fi";

type CaseEntryToolbarProps = {
  onAddRows: (count: number) => void;
  onClearAll: () => void;
  children?: React.ReactNode;
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 28,
  background: "var(--surface-border)",
  margin: "0 4px",
};

const CaseEntryToolbar: React.FC<CaseEntryToolbarProps> = ({
  onAddRows,
  onClearAll,
  children,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <button
        type="button"
        className="btn btn-success gap-2"
        onClick={() => onAddRows(1)}
      >
        <FiPlus size={15} />
        Add Row
      </button>
      <button
        type="button"
        className="btn btn-success btn-outline gap-2"
        onClick={() => onAddRows(5)}
      >
        <FiPlus size={15} />
        +5 Rows
      </button>
      <button
        type="button"
        className="btn btn-success btn-outline gap-2"
        onClick={() => onAddRows(10)}
      >
        <FiPlus size={15} />
        +10 Rows
      </button>

      <div style={separatorStyle} />

      <button
        type="button"
        className="btn btn-warning btn-outline"
        onClick={onClearAll}
      >
        Clear All
      </button>

      {children ? (
        <>
          <div style={separatorStyle} />
          {children}
        </>
      ) : null}
    </div>
  );
};

export default CaseEntryToolbar;
