"use client";

import {
  ActionDropdown,
  Table,
  TipCell,
} from "@rtc-database/shared";
import React, { useMemo, useState } from "react";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { getCommissionYearLabel, NotarialCommissionRecord } from "./schema";

interface Props {
  records: NotarialCommissionRecord[];
  selectedIds?: number[];
  onEdit: (record: NotarialCommissionRecord) => void;
  onDelete: (id: number) => void;
  onToggleSelect?: (id: number) => void;
}

type SortKey =
  | keyof Pick<
      NotarialCommissionRecord,
      "petition" | "name" | "termOfCommission" | "address"
    >
  | "yearLabel";

type SortOrder = "asc" | "desc";

type NotarialCommissionRow = NotarialCommissionRecord & {
  yearLabel: string;
};

const NotarialCommissionTable: React.FC<Props> = ({
  records,
  selectedIds = [],
  onEdit,
  onDelete,
  onToggleSelect,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const rows = useMemo<NotarialCommissionRow[]>(
    () =>
      records.map((record) => ({
        ...record,
        yearLabel: getCommissionYearLabel(
          record.termStartYear,
          record.termEndYear,
        ),
      })),
    [records],
  );

  const sorted = useMemo(() => {
    const direction = sortOrder === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const aVal = String(a[sortKey] ?? "");
      const bVal = String(b[sortKey] ?? "");
      return direction * aVal.localeCompare(bVal);
    });
  }, [rows, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortOrder("asc");
  };

  return (
    <div className="w-full bg-base-100 rounded-xl border border-base-200 overflow-hidden">
      <Table<NotarialCommissionRow>
        className="border-0 rounded-none"
        headers={[
          {
            key: "select",
            label: "Select",
            align: "center",
            className: "w-14",
          },
          {
            key: "actions",
            label: "Actions",
            align: "center",
            className: "w-16",
          },
          {
            key: "petition",
            label: "Petition",
            sortable: true,
            sortKey: "petition",
            align: "left",
          },
          {
            key: "name",
            label: "Name",
            sortable: true,
            sortKey: "name",
            align: "left",
          },
          {
            key: "termOfCommission",
            label: "Term of Commission",
            sortable: true,
            sortKey: "termOfCommission",
            align: "left",
          },
          {
            key: "yearLabel",
            label: "Date / Year",
            sortable: true,
            sortKey: "yearLabel",
            align: "left",
          },
          {
            key: "address",
            label: "Address",
            sortable: true,
            sortKey: "address",
            align: "left",
          },
        ]}
        data={sorted}
        rowsPerPage={10}
        sortConfig={{ key: sortKey, order: sortOrder }}
        onSort={(key) => handleSort(key as SortKey)}
        renderRow={(record) => {
          const popoverId = `notarial-commission-actions-${record.id}`;
          const anchorName = `--notarial-commission-actions-${record.id}`;

          const closeActionsPopover = () => {
            const popoverEl = document.getElementById(popoverId) as
              | (HTMLElement & { hidePopover?: () => void })
              | null;
            popoverEl?.hidePopover?.();
          };

          return (
            <tr
              key={record.id}
              className="border-b border-base-200 last:border-0 hover:bg-base-200/50 transition-colors duration-100 text-center"
            >
              <td className="py-4 px-3 text-center">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={selectedIds.includes(record.id)}
                  onChange={() => onToggleSelect?.(record.id)}
                  aria-label={`Select notarial commission ${record.id}`}
                />
              </td>
              <td className="py-4 px-5 text-center">
                <ActionDropdown
                  popoverId={popoverId}
                  anchorName={anchorName}
                  buttonClassName="btn btn-ghost btn-xs px-2 text-base-content/40 hover:text-base-content"
                  menuClassName="dropdown menu p-2 shadow-lg bg-base-100 rounded-xl w-44 border border-base-200"
                  iconSize={16}
                >
                  <li>
                    <button
                      className="flex items-center gap-3 text-warning text-sm py-2"
                      onClick={() => {
                        closeActionsPopover();
                        onEdit(record);
                      }}
                    >
                      <FiEdit size={14} />
                      Edit
                    </button>
                  </li>
                  <li>
                    <button
                      className="flex items-center gap-3 text-error text-sm py-2"
                      onClick={() => {
                        closeActionsPopover();
                        onDelete(record.id);
                      }}
                    >
                      <FiTrash2 size={14} />
                      Delete
                    </button>
                  </li>
                </ActionDropdown>
              </td>
              <TipCell
                label="Petition"
                value={record.petition}
                className="py-4 px-5 font-mono text-[13px] text-base-content/70"
              />
              <TipCell
                label="Name"
                value={record.name}
                className="py-4 px-5 font-semibold text-base-content"
              />
              <TipCell
                label="Term of Commission"
                value={record.termOfCommission}
                className="py-4 px-5 text-base-content/80"
              />
              <TipCell
                label="Date / Year"
                value={record.yearLabel}
                className="py-4 px-5 font-mono text-[13px] text-base-content/70"
              />
              <TipCell
                label="Address"
                value={record.address}
                className="py-4 px-5 text-base-content/70"
                truncate
              />
            </tr>
          );
        }}
      />
    </div>
  );
};

export default NotarialCommissionTable;
