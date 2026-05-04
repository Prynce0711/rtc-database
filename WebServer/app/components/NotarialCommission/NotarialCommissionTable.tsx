"use client";

import { buildGarageProxyUrl } from "@/app/lib/garageProxy";
import { FileViewerModal, Table, TipCell } from "@rtc-database/shared";
import React, { useEffect, useMemo, useState } from "react";
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

type NotarialCommissionContextMenuState = {
  x: number;
  y: number;
  record: NotarialCommissionRecord;
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
  const [contextMenu, setContextMenu] =
    useState<NotarialCommissionContextMenuState | null>(null);
  const [imageViewer, setImageViewer] = useState({
    open: false,
    url: "",
    title: "",
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    const closeMenu = () => setContextMenu(null);

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, []);

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

  const handleContextMenu = (
    event: React.MouseEvent,
    record: NotarialCommissionRecord,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      record,
    });
  };

  const openImageViewer = (record: NotarialCommissionRecord) => {
    if (!record.imageFile?.key) return;

    setImageViewer({
      open: true,
      url: buildGarageProxyUrl({
        bucket: "rtc-bucket",
        key: record.imageFile.key,
        fileName: record.imageFile.fileName,
        inline: true,
        contentType: record.imageFile.mimeType,
      }),
      title: record.name || "Notarial Commission Photo",
    });
  };

  const closeImageViewer = () => {
    setImageViewer({ open: false, url: "", title: "" });
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
            key: "petition",
            label: "Petition",
            sortable: true,
            sortKey: "petition",
            align: "left",
          },
          {
            key: "photo",
            label: "Photo",
            align: "center",
            className: "w-24",
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
          return (
            <tr
              key={record.id}
              onContextMenu={(event) => handleContextMenu(event, record)}
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
              <TipCell
                label="Petition"
                value={record.petition}
                className="py-4 px-5 font-mono text-[13px] text-base-content/70"
              />
              <td className="py-4 px-3 text-center">
                {record.imageFile?.key ? (
                  <button
                    type="button"
                    className="mx-auto h-11 w-11 rounded-xl border border-base-300 overflow-hidden cursor-zoom-in"
                    onClick={(event) => {
                      event.stopPropagation();
                      openImageViewer(record);
                    }}
                    aria-label={`View photo of ${record.name || "commission"}`}
                  >
                    <img
                      src={buildGarageProxyUrl({
                        bucket: "rtc-bucket",
                        key: record.imageFile.key,
                        fileName: record.imageFile.fileName,
                        inline: true,
                        contentType: record.imageFile.mimeType,
                      })}
                      alt={record.name || "Notarial commission"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <span className="text-xs text-base-content/35">No image</span>
                )}
              </td>
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
      <FileViewerModal
        open={imageViewer.open}
        loading={false}
        url={imageViewer.url}
        type="image"
        title={imageViewer.title}
        error=""
        onClose={closeImageViewer}
      />
      {contextMenu && (
        <div
          className="fixed z-[90] w-44 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-2xl"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-warning"
            onClick={() => {
              const target = contextMenu.record;
              setContextMenu(null);
              onEdit(target);
            }}
          >
            <FiEdit className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-error"
            onClick={() => {
              const target = contextMenu.record;
              setContextMenu(null);
              onDelete(target.id);
            }}
          >
            <FiTrash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default NotarialCommissionTable;
