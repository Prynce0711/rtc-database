"use client";

import { RedirectingUI, Roles, Table, usePopup } from "@rtc-database/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiEdit2, FiFileText, FiPlus, FiTrash2 } from "react-icons/fi";
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
          data={records as unknown as Record<string, unknown>[]}
          rowsPerPage={10}
          resizableColumns
          disableCellTooltips={false}
          minColumnWidth={120}
          renderRow={(item) => {
            const record = item as unknown as CivilTransmittalTableRecord;
            return (
              <tr key={record.id} className="hover">
                <td className="px-4 py-3 text-sm font-semibold text-base-content">
                  {record.id}
                </td>
                {config.fields.map((field) => (
                  <td
                    key={field.key}
                    className="px-4 py-3 text-sm text-base-content/75 align-top"
                  >
                    {formatValue(record, field)}
                  </td>
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
