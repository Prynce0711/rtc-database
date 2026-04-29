"use client";

import React from "react";

type NumericField = {
  key: string;
  label: string;
  group: string;
};

type ColumnWidths = {
  select: number;
  rowNumber: number;
  branch: number;
  raffleDate: number;
  total: number;
};

export interface StatsTableProps {
  rows: Array<Record<string, any>>;
  numericFields: NumericField[];
  columnWidths: ColumnWidths;
  numericColumnWidths: Record<string, number>;
  selectedRows?: Set<string>;
  onToggleSelectRow?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onUpdateRow?: (id: string, field: keyof any, value: string | number) => void;
  editable?: boolean;
  showCheckboxes?: boolean;
  emptyStateMessage?: string;
  rowKeyField?: string;
  renderBranchCell?: (row: Record<string, any>, value: string) => React.ReactNode;
  renderDateCell?: (row: Record<string, any>, value: string) => React.ReactNode;
  renderNumericCell?: (row: Record<string, any>, field: NumericField, value: number | string) => React.ReactNode;
  renderTotalCell?: (row: Record<string, any>, total: number | string) => React.ReactNode;
}

const StatsTable: React.FC<StatsTableProps> = ({
  rows,
  numericFields,
  columnWidths,
  numericColumnWidths,
  selectedRows = new Set(),
  onToggleSelectRow,
  onToggleSelectAll,
  onUpdateRow,
  editable = false,
  showCheckboxes = false,
  emptyStateMessage = "No rows to display",
  rowKeyField = "id",
  renderBranchCell,
  renderDateCell,
  renderNumericCell,
  renderTotalCell,
}) => {
  // Group fields by their group name
  const fieldGroups = React.useMemo(() => {
    const groups = new Map<string, NumericField[]>();
    numericFields
      .filter((field) => field.group !== "total")
      .forEach((field) => {
        if (!groups.has(field.group)) {
          groups.set(field.group, []);
        }
        groups.get(field.group)!.push(field);
      });
    return groups;
  }, [numericFields]);

  // Group colors
  const groupColors: Record<string, string> = {
    civil: "text-primary",
    lrc: "text-info",
    criminal: "text-success",
  };

  const allRowsSelected =
    rows.length > 0 && rows.every((row) => selectedRows.has(row[rowKeyField]));

  const editableFieldsExcludingTotal = numericFields.filter(
    (field) => field.group !== "total"
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-base-200 bg-base-100">
      <table
        className="table table-pin-rows table-xs sm:table-sm w-max min-w-full"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          {showCheckboxes && <col style={{ width: columnWidths.select }} />}
          <col style={{ width: columnWidths.rowNumber }} />
          <col style={{ width: columnWidths.branch }} />
          <col style={{ width: columnWidths.raffleDate }} />
          {editableFieldsExcludingTotal.map((field) => (
            <col
              key={field.key}
              style={{
                width: numericColumnWidths[field.key] ?? 108,
              }}
            />
          ))}
          <col style={{ width: columnWidths.total }} />
        </colgroup>

        <thead>
          {/* Group header row */}
          <tr className="bg-base-200/70">
            {showCheckboxes && (
              <th
                rowSpan={2}
                className="text-center align-middle overflow-hidden whitespace-nowrap px-2 py-3"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={allRowsSelected}
                  onChange={onToggleSelectAll}
                />
              </th>
            )}
            <th
              rowSpan={2}
              className="text-center align-middle overflow-hidden whitespace-nowrap px-2 py-3"
            >
              #
            </th>
            <th
              rowSpan={2}
              className="text-center align-middle overflow-hidden whitespace-nowrap px-2 py-3"
            >
              Branch
            </th>
            <th
              rowSpan={2}
              className="text-center align-middle overflow-hidden whitespace-nowrap px-2 py-3"
            >
              Raffle Date
            </th>

            {Array.from(fieldGroups.entries()).map(([groupName, groupFields]) => (
              <th
                key={groupName}
                colSpan={groupFields.length}
                className={`text-center overflow-hidden whitespace-nowrap px-2 py-3 ${groupColors[groupName] || "text-base-content"}`}
              >
                <span className="block truncate">
                  {groupName === "civil"
                    ? "Civil"
                    : groupName === "lrc"
                      ? "LRC / PET. / SPC."
                      : groupName === "criminal"
                        ? "Criminal"
                        : groupName}
                </span>
              </th>
            ))}

            <th
              rowSpan={2}
              className="text-center align-middle text-warning overflow-hidden whitespace-nowrap px-2 py-3"
            >
              Total
            </th>
          </tr>

          {/* Field header row */}
          <tr className="bg-base-200/40">
            {editableFieldsExcludingTotal.map((field) => (
              <th
                key={field.key}
                className="text-center overflow-hidden whitespace-nowrap px-2 py-3"
              >
                <span className="block truncate text-xs">{field.label}</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={
                  (showCheckboxes ? 1 : 0) +
                  3 +
                  editableFieldsExcludingTotal.length +
                  1
                }
                className="py-12 text-center text-base-content/45"
              >
                {emptyStateMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const rowId = row[rowKeyField];
              const isSelected = selectedRows.has(rowId);

              return (
                <tr key={rowId} className="hover:bg-base-200/30">
                  {showCheckboxes && (
                    <td className="text-center px-2 py-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={isSelected}
                        onChange={() => onToggleSelectRow?.(rowId)}
                      />
                    </td>
                  )}

                  <td className="text-center tabular-nums px-2 py-2">{index + 1}</td>

                  {/* Branch */}
                  <td className="min-w-0 px-2 py-2 overflow-hidden">
                    {renderBranchCell ? (
                      renderBranchCell(row, row.branch || "")
                    ) : editable ? (
                      <input
                        type="text"
                        className="input input-bordered input-xs sm:input-sm w-full min-w-0"
                        value={row.branch || ""}
                        placeholder="Branch"
                        onChange={(event) =>
                          onUpdateRow?.(rowId, "branch", event.target.value)
                        }
                      />
                    ) : (
                      <span className="block truncate">{row.branch}</span>
                    )}
                  </td>

                  {/* Raffle Date */}
                  <td className="min-w-0 px-2 py-2 overflow-hidden">
                    {renderDateCell ? (
                      renderDateCell(row, row.raffleDate || "")
                    ) : editable ? (
                      <input
                        type="date"
                        className="input input-bordered input-xs sm:input-sm w-full min-w-0"
                        value={row.raffleDate || ""}
                        onChange={(event) =>
                          onUpdateRow?.(rowId, "raffleDate", event.target.value)
                        }
                      />
                    ) : (
                      <span className="block truncate">{row.raffleDate}</span>
                    )}
                  </td>

                  {/* Numeric fields */}
                  {editableFieldsExcludingTotal.map((field) => (
                    <td key={field.key} className="text-center min-w-0 px-1 py-2 overflow-hidden">
                      {renderNumericCell ? (
                        renderNumericCell(row, field, row[field.key] || 0)
                      ) : editable ? (
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-xs sm:input-sm w-full min-w-0 text-center"
                          value={row[field.key] || ""}
                          onChange={(event) =>
                            onUpdateRow?.(
                              rowId,
                              field.key,
                              Number(event.target.value) || 0
                            )
                          }
                        />
                      ) : (
                        <span className="block">{row[field.key]}</span>
                      )}
                    </td>
                  ))}

                  {/* Total */}
                  <td className="text-center font-bold tabular-nums px-2 py-2 overflow-hidden">
                    {renderTotalCell ? (
                      renderTotalCell(row, row.total || 0)
                    ) : (
                      <span className="block">{(row.total || 0).toLocaleString?.()}</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StatsTable;
