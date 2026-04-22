"use client";

import React from "react";
import { FiPlus } from "react-icons/fi";

type AddRowsToolbarProps = {
  onAddRows: (count: number) => void;
  children?: React.ReactNode;
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 28,
  background: "var(--surface-border)",
  margin: "0 4px",
};

const AddRowsToolbar: React.FC<AddRowsToolbarProps> = ({
  onAddRows,
  children,
}) => {
  const [customRows, setCustomRows] = React.useState("1");

  const parsedCustomRows = Number.parseInt(customRows, 10);
  const canAddCustomRows =
    Number.isFinite(parsedCustomRows) && parsedCustomRows > 0;

  const handleAddCustomRows = React.useCallback(() => {
    if (!canAddCustomRows) return;
    onAddRows(parsedCustomRows);
  }, [canAddCustomRows, onAddRows, parsedCustomRows]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
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

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-subtle)",
            whiteSpace: "nowrap",
          }}
        >
          Enter Rows
        </span>
        <input
          type="number"
          min={1}
          step={1}
          value={customRows}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (/^\d*$/.test(nextValue)) {
              setCustomRows(nextValue);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAddCustomRows();
            }
          }}
          className="input input-bordered input-sm w-20"
          aria-label="Enter number of rows to add"
        />
        <button
          type="button"
          className="btn btn-success btn-outline gap-2"
          onClick={handleAddCustomRows}
          disabled={!canAddCustomRows}
        >
          <FiPlus size={15} />
          Add
        </button>
      </div>

      {children ? (
        <>
          <div style={separatorStyle} />
          {children}
        </>
      ) : null}
    </div>
  );
};

export default AddRowsToolbar;
