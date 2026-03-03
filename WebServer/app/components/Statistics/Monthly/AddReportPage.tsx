"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiCopy,
  FiEdit3,
  FiEye,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import type { MonthlyRow } from "./types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EditableRow {
  id: string;
  category: string;
  branch: string;
  criminal: number;
  civil: number;
}

export interface AddReportPageProps {
  month: string;
  onBack: () => void;
  onSave: (rows: MonthlyRow[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_OPTIONS = ["New Cases Filed", "Cases Disposed", "Pending Cases"];

const BRANCH_OPTIONS = ["RTC 1", "RTC 2", "RTC 3", "RTC 4", "RTC 5"];

const emptyRow = (): EditableRow => ({
  id: crypto.randomUUID(),
  category: "",
  branch: "",
  criminal: 0,
  civil: 0,
});

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const AddReportPage: React.FC<AddReportPageProps> = ({
  month,
  onBack,
  onSave,
}) => {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    Array.from({ length: 10 }, emptyRow),
  );
  const [activeCell, setActiveCell] = useState<{
    rowIdx: number;
    col: string;
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"edit" | "review">("edit");

  const tableRef = useRef<HTMLDivElement>(null);

  const monthLabel = new Date(month + "-01").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  /* ---------------------------------------------------------------- */
  /*  Row helpers                                                      */
  /* ---------------------------------------------------------------- */

  const addRows = (count: number = 1) => {
    setRows((prev) => [...prev, ...Array.from({ length: count }, emptyRow)]);
  };

  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setRows((prev) => prev.filter((r) => !selectedRows.has(r.id)));
    setSelectedRows(new Set());
  };

  const duplicateSelectedRows = () => {
    if (selectedRows.size === 0) return;
    const dupes = rows
      .filter((r) => selectedRows.has(r.id))
      .map((r) => ({ ...r, id: crypto.randomUUID() }));
    setRows((prev) => [...prev, ...dupes]);
    setSelectedRows(new Set());
  };

  const clearAll = () => {
    setRows(Array.from({ length: 10 }, emptyRow));
    setActiveCell(null);
    setSelectedRows(new Set());
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map((r) => r.id)));
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Cell update                                                      */
  /* ---------------------------------------------------------------- */

  const updateCell = useCallback(
    (rowId: string, field: keyof EditableRow, value: string | number) => {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /*  Keyboard navigation                                              */
  /* ---------------------------------------------------------------- */

  const COLS = ["category", "branch", "criminal", "civil"] as const;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, col: string) => {
      const colIdx = COLS.indexOf(col as (typeof COLS)[number]);
      if (colIdx === -1) return;

      let nextRow = rowIdx;
      let nextCol = colIdx;

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            nextCol--;
            if (nextCol < 0) {
              nextCol = COLS.length - 1;
              nextRow--;
            }
          } else {
            nextCol++;
            if (nextCol >= COLS.length) {
              nextCol = 0;
              nextRow++;
            }
          }
          break;
        case "Enter":
          e.preventDefault();
          nextRow++;
          break;
        case "ArrowDown":
          if (col === "criminal" || col === "civil") {
            e.preventDefault();
            nextRow++;
          }
          break;
        case "ArrowUp":
          if (col === "criminal" || col === "civil") {
            e.preventDefault();
            nextRow--;
          }
          break;
        default:
          return;
      }

      if (nextRow < 0) nextRow = 0;
      if (nextRow >= rows.length) {
        addRows(1);
        nextRow = rows.length;
      }
      if (nextCol < 0) nextCol = 0;
      if (nextCol >= COLS.length) nextCol = COLS.length - 1;

      setActiveCell({ rowIdx: nextRow, col: COLS[nextCol] });
    },
    [rows.length],
  );

  /* ---------------------------------------------------------------- */
  /*  Paste from Excel                                                 */
  /* ---------------------------------------------------------------- */

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;

    e.preventDefault();

    const pastedRows = text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => {
        const cells = line.split("\t");
        return {
          id: crypto.randomUUID(),
          category: (cells[0] ?? "").trim(),
          branch: (cells[1] ?? "").trim(),
          criminal: Number(cells[2]) || 0,
          civil: Number(cells[3]) || 0,
        } as EditableRow;
      });

    if (pastedRows.length > 0) {
      setRows((prev) => {
        const hasData = prev.some(
          (r) => r.category || r.branch || r.criminal || r.civil,
        );
        return hasData ? [...prev, ...pastedRows] : pastedRows;
      });
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Save                                                             */
  /* ---------------------------------------------------------------- */

  const handleSave = () => {
    const validRows = rows.filter((r) => r.category && r.branch);
    if (validRows.length === 0) return;

    const mapped: MonthlyRow[] = validRows.map((r) => ({
      month,
      category: r.category,
      branch: r.branch,
      criminal: r.criminal,
      civil: r.civil,
      total: r.criminal + r.civil,
    }));

    onSave(mapped);
    onBack();
  };

  const validCount = rows.filter((r) => r.category && r.branch).length;

  const validRows = useMemo(
    () => rows.filter((r) => r.category && r.branch),
    [rows],
  );

  /* ---- Review grouped data ---- */
  const reviewGrouped = useMemo(() => {
    const map = new Map<
      string,
      { branch: string; criminal: number; civil: number; total: number }[]
    >();
    validRows.forEach((r) => {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push({
        branch: r.branch,
        criminal: r.criminal,
        civil: r.civil,
        total: r.criminal + r.civil,
      });
    });
    return map;
  }, [validRows]);

  const reviewTotals = useMemo(
    () => ({
      criminal: validRows.reduce((s, r) => s + r.criminal, 0),
      civil: validRows.reduce((s, r) => s + r.civil, 0),
      total: validRows.reduce((s, r) => s + r.criminal + r.civil, 0),
    }),
    [validRows],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-0 flex flex-col h-full min-h-[calc(100vh-6rem)]">
      {/* ── HEADER ── */}
      <header className="card bg-base-100 shadow-xl rounded-b-none">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                className="btn btn-ghost btn-circle"
                onClick={step === "review" ? () => setStep("edit") : onBack}
                title={
                  step === "review" ? "Back to Edit" : "Back to Monthly Reports"
                }
              >
                <FiArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-base-content">
                  {step === "edit" ? "Add Monthly Report" : "Review Report"}
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                  <FiCalendar className="shrink-0" />
                  <span>
                    {step === "edit" ? (
                      <>
                        Entering data for{" "}
                        <span className="text-primary font-semibold">
                          {monthLabel}
                        </span>{" "}
                        — type directly or paste from Excel
                      </>
                    ) : (
                      <>
                        Review your entries for{" "}
                        <span className="text-primary font-semibold">
                          {monthLabel}
                        </span>{" "}
                        before saving
                      </>
                    )}
                  </span>
                </p>
              </div>
            </div>

            {/* ── STEP INDICATOR ── */}
            <div className="flex items-center gap-0">
              {/* Step 1 */}
              <button
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setStep("edit")}
              >
                <div
                  className={`flex items-center justify-center h-9 w-9 rounded-full font-bold text-sm transition-all ${
                    step === "edit"
                      ? "bg-primary text-primary-content shadow-lg shadow-primary/30 scale-110"
                      : "bg-success text-success-content"
                  }`}
                >
                  {step === "review" ? (
                    <FiCheck className="h-4 w-4" />
                  ) : (
                    <FiEdit3 className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-bold hidden sm:inline ${
                    step === "edit" ? "text-primary" : "text-success"
                  }`}
                >
                  Enter Data
                </span>
              </button>

              {/* Connector */}
              <div
                className={`w-12 sm:w-20 h-1 mx-2 rounded-full transition-colors ${
                  step === "review" ? "bg-primary" : "bg-base-300"
                }`}
              />

              {/* Step 2 */}
              <button
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => validCount > 0 && setStep("review")}
                disabled={validCount === 0 && step === "edit"}
              >
                <div
                  className={`flex items-center justify-center h-9 w-9 rounded-full font-bold text-sm transition-all ${
                    step === "review"
                      ? "bg-primary text-primary-content shadow-lg shadow-primary/30 scale-110"
                      : "bg-base-300 text-base-content/40"
                  }`}
                >
                  <FiEye className="h-4 w-4" />
                </div>
                <span
                  className={`text-sm font-bold hidden sm:inline ${
                    step === "review" ? "text-primary" : "text-base-content/40"
                  }`}
                >
                  Review & Save
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── STEP CONTENT ── */}
      {step === "edit" ? (
        <>
          {/* ── TOOLBAR ── */}
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-y border-base-300 bg-base-200/40">
            <button
              className="btn btn-sm btn-outline btn-success gap-1.5"
              onClick={() => addRows(1)}
            >
              <FiPlus className="h-4 w-4" />
              Add Row
            </button>
            <button
              className="btn btn-sm btn-outline gap-1.5"
              onClick={() => addRows(5)}
            >
              <FiPlus className="h-4 w-4" />
              Add 5 Rows
            </button>
            <button
              className="btn btn-sm btn-outline gap-1.5"
              onClick={() => addRows(10)}
            >
              <FiPlus className="h-4 w-4" />
              Add 10 Rows
            </button>

            <div className="divider divider-horizontal mx-1 h-6" />

            <button
              className="btn btn-sm btn-outline btn-info gap-1.5"
              onClick={duplicateSelectedRows}
              disabled={selectedRows.size === 0}
            >
              <FiCopy className="h-4 w-4" />
              Duplicate
            </button>
            <button
              className="btn btn-sm btn-outline btn-error gap-1.5"
              onClick={deleteSelectedRows}
              disabled={selectedRows.size === 0}
            >
              <FiTrash2 className="h-4 w-4" />
              Delete{selectedRows.size > 0 ? ` (${selectedRows.size})` : ""}
            </button>

            <div className="divider divider-horizontal mx-1 h-6" />

            <button
              className="btn btn-sm btn-outline btn-warning gap-1.5"
              onClick={clearAll}
            >
              Clear All
            </button>

            <span className="ml-auto text-xs text-base-content/50 tabular-nums font-medium">
              {rows.length} row{rows.length !== 1 && "s"} •{" "}
              <span className="text-success font-semibold">
                {validCount} valid
              </span>
            </span>
          </div>

          {/* ── EXCEL-LIKE TABLE ── */}
          <div
            ref={tableRef}
            className="flex-1 overflow-auto bg-base-100 border-x border-base-300/50"
            onPaste={handlePaste}
          >
            <table className="table table-sm w-full border-collapse">
              <colgroup>
                <col className="w-10" />
                <col className="w-10" />
                <col className="w-[28%]" />
                <col className="w-[24%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
              </colgroup>

              <thead className="sticky top-0 z-10">
                <tr className="bg-base-300 text-base-content text-xs uppercase tracking-widest">
                  <th className="py-3 px-2 text-center border-r border-base-content/10">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={
                        rows.length > 0 && selectedRows.size === rows.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="py-3 px-2 text-center font-extrabold border-r border-base-content/10">
                    #
                  </th>
                  <th className="py-3 px-3 text-left font-extrabold border-r border-base-content/10">
                    Category
                  </th>
                  <th className="py-3 px-3 text-left font-extrabold border-r border-base-content/10">
                    Branch
                  </th>
                  <th className="py-3 px-3 text-center font-extrabold border-r border-base-content/10">
                    Criminal
                  </th>
                  <th className="py-3 px-3 text-center font-extrabold border-r border-base-content/10">
                    Civil
                  </th>
                  <th className="py-3 px-3 text-center font-extrabold bg-base-content/5">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => {
                  const isSelected = selectedRows.has(row.id);
                  const total = row.criminal + row.civil;

                  return (
                    <tr
                      key={row.id}
                      className={`group transition-colors duration-75 ${
                        isSelected
                          ? "bg-primary/10"
                          : idx % 2 === 0
                            ? "bg-base-100"
                            : "bg-base-200/30"
                      } hover:bg-primary/5`}
                    >
                      {/* Checkbox */}
                      <td className="px-2 py-1 text-center border-r border-base-300/40">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.id)}
                        />
                      </td>

                      {/* Row number */}
                      <td className="px-2 py-1 text-center text-xs text-base-content/40 font-mono border-r border-base-300/40 select-none">
                        {idx + 1}
                      </td>

                      {/* Category */}
                      <td
                        className={`px-1 py-1 border-r border-base-300/40 ${
                          activeCell?.rowIdx === idx &&
                          activeCell?.col === "category"
                            ? "ring-2 ring-primary ring-inset"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveCell({ rowIdx: idx, col: "category" })
                        }
                      >
                        <select
                          className="select select-ghost select-sm w-full font-medium"
                          value={row.category}
                          onChange={(e) =>
                            updateCell(row.id, "category", e.target.value)
                          }
                          onFocus={() =>
                            setActiveCell({ rowIdx: idx, col: "category" })
                          }
                          onKeyDown={(e) => handleKeyDown(e, idx, "category")}
                        >
                          <option value="" disabled>
                            Select category…
                          </option>
                          {CATEGORY_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Branch */}
                      <td
                        className={`px-1 py-1 border-r border-base-300/40 ${
                          activeCell?.rowIdx === idx &&
                          activeCell?.col === "branch"
                            ? "ring-2 ring-primary ring-inset"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveCell({ rowIdx: idx, col: "branch" })
                        }
                      >
                        <select
                          className="select select-ghost select-sm w-full font-medium"
                          value={row.branch}
                          onChange={(e) =>
                            updateCell(row.id, "branch", e.target.value)
                          }
                          onFocus={() =>
                            setActiveCell({ rowIdx: idx, col: "branch" })
                          }
                          onKeyDown={(e) => handleKeyDown(e, idx, "branch")}
                        >
                          <option value="" disabled>
                            Select branch…
                          </option>
                          {BRANCH_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Criminal */}
                      <td
                        className={`px-1 py-1 border-r border-base-300/40 ${
                          activeCell?.rowIdx === idx &&
                          activeCell?.col === "criminal"
                            ? "ring-2 ring-primary ring-inset"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveCell({ rowIdx: idx, col: "criminal" })
                        }
                      >
                        <input
                          type="number"
                          min={0}
                          className="input input-ghost input-sm w-full text-center tabular-nums font-medium"
                          value={row.criminal || ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateCell(
                              row.id,
                              "criminal",
                              Number(e.target.value) || 0,
                            )
                          }
                          onFocus={(e) => {
                            setActiveCell({ rowIdx: idx, col: "criminal" });
                            e.target.select();
                          }}
                          onKeyDown={(e) => handleKeyDown(e, idx, "criminal")}
                        />
                      </td>

                      {/* Civil */}
                      <td
                        className={`px-1 py-1 border-r border-base-300/40 ${
                          activeCell?.rowIdx === idx &&
                          activeCell?.col === "civil"
                            ? "ring-2 ring-primary ring-inset"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveCell({ rowIdx: idx, col: "civil" })
                        }
                      >
                        <input
                          type="number"
                          min={0}
                          className="input input-ghost input-sm w-full text-center tabular-nums font-medium"
                          value={row.civil || ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateCell(
                              row.id,
                              "civil",
                              Number(e.target.value) || 0,
                            )
                          }
                          onFocus={(e) => {
                            setActiveCell({ rowIdx: idx, col: "civil" });
                            e.target.select();
                          }}
                          onKeyDown={(e) => handleKeyDown(e, idx, "civil")}
                        />
                      </td>

                      {/* Total (auto) */}
                      <td className="px-3 py-1 text-center tabular-nums font-bold text-base bg-base-content/[0.03]">
                        <span
                          className={
                            total > 0
                              ? "text-base-content"
                              : "text-base-content/30"
                          }
                        >
                          {total > 0 ? total.toLocaleString() : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* ── Footer totals ── */}
              <tfoot className="sticky bottom-0">
                <tr className="bg-base-300 font-bold text-sm">
                  <td
                    colSpan={4}
                    className="px-3 py-3 text-right uppercase tracking-wider text-base-content/60"
                  >
                    Totals
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums text-base">
                    {rows.reduce((s, r) => s + r.criminal, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums text-base">
                    {rows.reduce((s, r) => s + r.civil, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums text-base font-extrabold bg-base-content/5">
                    {rows
                      .reduce((s, r) => s + r.criminal + r.civil, 0)
                      .toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── BOTTOM BAR (Edit) ── */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-base-300 bg-base-200/50 rounded-b-xl shadow-xl">
            <p className="text-xs text-base-content/40">
              Tip: You can paste data directly from Excel (Category, Branch,
              Criminal, Civil columns). Use Tab/Enter to navigate cells.
            </p>
            <div className="flex items-center gap-3">
              <button className="btn btn-ghost" onClick={onBack}>
                Cancel
              </button>
              <button
                className="btn btn-outline btn-primary gap-2"
                onClick={() => setStep("review")}
                disabled={validCount === 0}
              >
                <FiEye className="h-5 w-5" />
                Review
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── REVIEW VIEW ── */}
          <div className="flex-1 overflow-auto bg-base-100 border-x border-base-300/50 p-4 sm:p-6 space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card bg-base-200/50 shadow">
                <div className="card-body p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-base-content/50 font-bold">
                    Total Criminal
                  </p>
                  <p className="text-3xl font-black text-base-content">
                    {reviewTotals.criminal.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="card bg-base-200/50 shadow">
                <div className="card-body p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-base-content/50 font-bold">
                    Total Civil
                  </p>
                  <p className="text-3xl font-black text-base-content">
                    {reviewTotals.civil.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="card bg-primary/10 shadow">
                <div className="card-body p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-primary/70 font-bold">
                    Grand Total
                  </p>
                  <p className="text-3xl font-black text-primary">
                    {reviewTotals.total.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Review table */}
            <div className="bg-base-100 rounded-xl shadow-lg border border-base-300/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[24%]" />
                    <col className="w-[22%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-base-300 text-base-content text-xs uppercase tracking-widest">
                      <th className="py-3 px-4 text-center font-extrabold">
                        #
                      </th>
                      <th className="py-3 px-4 text-left font-extrabold">
                        Category
                      </th>
                      <th className="py-3 px-4 text-left font-extrabold">
                        Branch
                      </th>
                      <th className="py-3 px-4 text-center font-extrabold">
                        Criminal
                      </th>
                      <th className="py-3 px-4 text-center font-extrabold">
                        Civil
                      </th>
                      <th className="py-3 px-4 text-center font-extrabold bg-base-content/5">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-200">
                    {Array.from(reviewGrouped.entries()).map(
                      ([category, catRows]) => (
                        <React.Fragment key={category}>
                          {catRows.map((r, rIdx) => (
                            <tr
                              key={`${category}-${r.branch}-${rIdx}`}
                              className={`${
                                rIdx % 2 === 0
                                  ? "bg-base-100"
                                  : "bg-base-200/25"
                              } hover:bg-primary/5 transition-colors`}
                            >
                              {rIdx === 0 && (
                                <td
                                  rowSpan={catRows.length}
                                  className="px-4 py-3 text-center align-middle text-xs text-base-content/40 font-mono border-r border-base-200/60"
                                >
                                  {Array.from(reviewGrouped.keys()).indexOf(
                                    category,
                                  ) + 1}
                                </td>
                              )}
                              {rIdx === 0 && (
                                <td
                                  rowSpan={catRows.length}
                                  className="px-4 py-3 align-middle border-r border-base-200/60"
                                >
                                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold bg-primary/10 text-primary">
                                    <span className="h-2 w-2 rounded-full bg-primary" />
                                    {category}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-3 font-medium text-base text-base-content">
                                {r.branch}
                              </td>
                              <td className="px-4 py-3 text-center tabular-nums text-base">
                                {r.criminal.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center tabular-nums text-base">
                                {r.civil.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center tabular-nums text-base font-semibold bg-base-content/[0.02]">
                                {r.total.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                          {/* Category subtotal */}
                          <tr className="bg-base-200/60">
                            <td
                              colSpan={3}
                              className="px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-base-content/50"
                            >
                              Subtotal — {category}
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold tabular-nums text-base text-base-content/80">
                              {catRows
                                .reduce((s, r) => s + r.criminal, 0)
                                .toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold tabular-nums text-base text-base-content/80">
                              {catRows
                                .reduce((s, r) => s + r.civil, 0)
                                .toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-center font-extrabold tabular-nums text-base bg-base-300/40">
                              {catRows
                                .reduce((s, r) => s + r.total, 0)
                                .toLocaleString()}
                            </td>
                          </tr>
                        </React.Fragment>
                      ),
                    )}

                    {/* Grand total */}
                    <tr className="bg-primary text-primary-content">
                      <td
                        colSpan={3}
                        className="px-4 py-4 font-black text-sm uppercase tracking-widest"
                      >
                        Grand Total
                      </td>
                      <td className="px-4 py-4 text-center font-black tabular-nums text-base">
                        {reviewTotals.criminal.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center font-black tabular-nums text-base">
                        {reviewTotals.civil.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center font-black tabular-nums text-base bg-primary-focus/20">
                        {reviewTotals.total.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── BOTTOM BAR (Review) ── */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-base-300 bg-base-200/50 rounded-b-xl shadow-xl">
            <button
              className="btn btn-outline gap-2"
              onClick={() => setStep("edit")}
            >
              <FiEdit3 className="h-5 w-5" />
              Go Back to Edit
            </button>
            <div className="flex items-center gap-3">
              <button className="btn btn-ghost" onClick={onBack}>
                Cancel
              </button>
              <button
                className="btn btn-outline btn-success gap-2"
                onClick={handleSave}
              >
                <FiCheck className="h-5 w-5" />
                Confirm & Save{" "}
                {validCount > 0 &&
                  `(${validCount} row${validCount !== 1 ? "s" : ""})`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AddReportPage;
