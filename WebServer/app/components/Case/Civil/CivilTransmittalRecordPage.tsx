"use client";

import {
  RedirectingUI,
  Roles,
  Table,
  TipCell,
  usePopup,
} from "@rtc-database/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiPlus,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import {
  deleteCivilCifTransmittalRecord,
  deleteCivilTransmittalRecord,
  getCivilCifTransmittalRecords,
  getCivilTransmittalRecords,
} from "./CivilTransmittalActions";
import {
  CIVIL_CIF_TRANSMITTAL_FIELDS,
  CIVIL_TRANSMITTAL_RECORD_FIELDS,
  type CivilCifTransmittalRecordData,
  type CivilTransmittalKind,
  type CivilTransmittalRecordData,
  type RecordField,
} from "./CivilTransmittalFields";

type CivilTransmittalTableRecord =
  | CivilCifTransmittalRecordData
  | CivilTransmittalRecordData;

const pageConfig = {
  cif: {
    title: "Court of First Instance Transmittal Record",
    subtitle: "Manage CFI case transmittals",
    href: "/user/cases/civil/cif",
    fields: CIVIL_CIF_TRANSMITTAL_FIELDS,
  },
  transmittal: {
    title: "Civil Transmittal Record",
    subtitle: "Manage civil transmittal and raffle records",
    href: "/user/cases/civil/transmittal",
    fields: CIVIL_TRANSMITTAL_RECORD_FIELDS,
  },
} as const;

const CIVIL_VIEW_OPTIONS = [
  {
    key: "civil",
    label: "Civil Cases",
    description: "Civil case records",
    href: "/user/cases/civil",
  },
  {
    key: "cif",
    label: "CFI",
    description: "CFI transmittal records",
    href: "/user/cases/civil/cif",
  },
  {
    key: "transmittal",
    label: "Transmittal",
    description: "Civil transmittal records",
    href: "/user/cases/civil/transmittal",
  },
] as const;

const formatValue = (
  record: CivilTransmittalTableRecord,
  field: RecordField,
): string => {
  const value = (record as unknown as Record<string, unknown>)[field.key];
  if (value == null || value === "") return "-";

  if (field.type === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString();
  }

  return String(value);
};

const normalizeSearchValue = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .trim();

const matchesSearch = (
  record: CivilTransmittalTableRecord,
  fields: readonly RecordField[],
  query: string,
): boolean => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  const values = [
    record.id,
    ...fields.map((field) => formatValue(record, field)),
  ];

  return values.some((value) =>
    normalizeSearchValue(value).includes(normalizedQuery),
  );
};

const downloadRecordsExcel = (
  title: string,
  fields: readonly RecordField[],
  records: CivilTransmittalTableRecord[],
): void => {
  const rows = records.map((record) => ({
    ID: record.id,
    ...Object.fromEntries(
      fields.map((field) => [field.label, formatValue(record, field)]),
    ),
  }));
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Records");
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  XLSX.writeFile(workbook, `${slug || "records"}-export-${Date.now()}.xlsx`);
};

export default function CivilTransmittalRecordPage({
  kind,
  role,
}: {
  kind: CivilTransmittalKind;
  role: Roles;
}) {
  const router = useRouter();
  const popup = usePopup();
  const config = pageConfig[kind];
  const canManage = role === Roles.ADMIN || role === Roles.CRIMINAL;
  const [records, setRecords] = useState<CivilTransmittalTableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchRecords = useCallback(async () => {
    const result =
      kind === "cif"
        ? await getCivilCifTransmittalRecords()
        : await getCivilTransmittalRecords();

    if (!result.success) {
      setError(result.error || "Failed to fetch records");
      setLoading(false);
      return;
    }

    setRecords(result.result ?? []);
    setError(null);
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchRecords();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchRecords]);

  const headers = useMemo(
    () => [
      { key: "id", label: "ID" },
      ...config.fields.map((field) => ({
        key: field.key,
        label: field.label,
      })),
      ...(canManage ? [{ key: "actions", label: "Actions" }] : []),
    ],
    [canManage, config.fields],
  );

  const filteredRecords = useMemo(
    () =>
      records.filter((record) =>
        matchesSearch(record, config.fields, searchQuery),
      ),
    [config.fields, records, searchQuery],
  );

  const handleDelete = async (id: number) => {
    if (!(await popup.showConfirm("Delete this transmittal record?"))) return;

    const result =
      kind === "cif"
        ? await deleteCivilCifTransmittalRecord(id)
        : await deleteCivilTransmittalRecord(id);

    if (!result.success) {
      popup.showError(result.error || "Failed to delete record");
      return;
    }

    popup.showSuccess("Record deleted successfully");
    await fetchRecords();
  };

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      popup.showError("No records to export.");
      return;
    }

    setExporting(true);
    try {
      downloadRecordsExcel(config.title, config.fields, filteredRecords);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <RedirectingUI titleText="Loading transmittal records..." />;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-base font-bold text-base-content mb-1">
                <span>Cases</span>
                <span className="text-base-content/30">/</span>
                <span className="text-base-content/70 font-medium">Civil</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                {config.title}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/50">
                <FiCalendar className="shrink-0" />
                <span>{config.subtitle}</span>
              </p>
            </div>

            {canManage && (
              <button
                className="btn btn-primary gap-2"
                onClick={() => router.push(`${config.href}/add`)}
              >
                <FiPlus className="h-5 w-5" />
                Add Record
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative w-full sm:w-96">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
            <input
              type="text"
              placeholder="Search records..."
              className="input input-bordered w-full pl-11"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <button
            type="button"
            className={`btn btn-info gap-2 ${exporting ? "loading" : ""}`}
            onClick={handleExport}
            disabled={exporting}
          >
            <FiDownload className="h-5 w-5" />
            {exporting ? "Exporting..." : "Export Excel"}
          </button>
          <span className="text-sm text-base-content/50 tabular-nums font-medium">
            {filteredRecords.length} record
            {filteredRecords.length !== 1 && "s"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          {CIVIL_VIEW_OPTIONS.map((view) => {
            const isActive = view.key === kind;
            return (
              <button
                key={view.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => router.push(view.href)}
                className={[
                  "min-w-[12rem] rounded-2xl border px-4 py-2 text-left transition-all",
                  isActive
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-base-200 bg-base-100 text-base-content/65 hover:border-base-300 hover:bg-base-200/40",
                ].join(" ")}
              >
                <div className="text-sm font-bold">{view.label}</div>
                <div className="mt-1 text-xs leading-4 opacity-75">
                  {view.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/40">
            Total Records
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-base-content">
            {records.length.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/40">
            Current View
          </p>
          <p className="mt-2 flex items-center gap-2 text-lg font-bold text-base-content">
            <FiFileText className="h-5 w-5 text-primary" />
            {config.title}
          </p>
        </div>
      </div>

      <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200 shadow-lg">
        <Table
          headers={headers}
          data={filteredRecords as unknown as Record<string, unknown>[]}
          rowsPerPage={10}
          resizableColumns
          disableCellTooltips={false}
          minColumnWidth={120}
          renderRow={(item) => {
            const record = item as unknown as CivilTransmittalTableRecord;
            return (
              <tr key={record.id} className="hover">
                <TipCell
                  label="ID"
                  value={record.id}
                  className="font-semibold text-base-content"
                  clickHint={false}
                />
                {config.fields.map((field) => (
                  <TipCell
                    key={field.key}
                    label={field.label}
                    value={formatValue(record, field)}
                    className="text-base-content/75"
                    truncate
                    clickHint={false}
                  />
                ))}
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          router.push(`${config.href}/add?id=${record.id}`)
                        }
                      >
                        <FiEdit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-error"
                        onClick={() => void handleDelete(record.id)}
                      >
                        <FiTrash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          }}
        />
      </div>
    </div>
  );
}
