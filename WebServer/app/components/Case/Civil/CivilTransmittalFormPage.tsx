"use client";

import { RedirectingUI, Roles, usePopup } from "@rtc-database/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import SpreadsheetRecordFormPage, {
  type SpreadsheetRecordField,
} from "../Shared/SpreadsheetRecordFormPage";
import {
  createCivilCifTransmittalRecord,
  createCivilCifTransmittalRecords,
  createCivilTransmittalRecord,
  createCivilTransmittalRecords,
  getCivilCifTransmittalRecordById,
  getCivilTransmittalRecordById,
  updateCivilCifTransmittalRecord,
  updateCivilTransmittalRecord,
} from "./CivilTransmittalActions";
import {
  CIVIL_CIF_TRANSMITTAL_FIELDS,
  CIVIL_TRANSMITTAL_RECORD_FIELDS,
  type CivilTransmittalKind,
} from "./CivilTransmittalFields";

const pageConfig = {
  cif: {
    title: "Court of First Instance Transmittal Record",
    href: "/user/cases/civil/cif",
    fields: CIVIL_CIF_TRANSMITTAL_FIELDS,
  },
  transmittal: {
    title: "Civil Transmittal Record",
    href: "/user/cases/civil/transmittal",
    fields: CIVIL_TRANSMITTAL_RECORD_FIELDS,
  },
} as const;

export default function CivilTransmittalFormPage({
  kind,
  role,
}: {
  kind: CivilTransmittalKind;
  role: Roles;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const popup = usePopup();
  const config = pageConfig[kind];
  const idParam = searchParams.get("id");
  const recordId = idParam ? Number(idParam) : null;
  const isEditing = Number.isInteger(recordId) && Number(recordId) > 0;
  const canManage = role === Roles.ADMIN || role === Roles.CRIMINAL;
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>();
  const [loading, setLoading] = useState(Boolean(isEditing));

  const pageTitle = useMemo(
    () => `${isEditing ? "Edit" : "Add"} ${config.title}`,
    [config.title, isEditing],
  );

  const spreadsheetFields = useMemo(
    () =>
      config.fields.map(
        (field): SpreadsheetRecordField => ({
          key: field.key,
          label: field.label,
          type: field.type,
          placeholder: field.label,
          width:
            field.type === "date"
              ? 160
              : field.type === "textarea"
                ? 300
                : undefined,
        }),
      ),
    [config.fields],
  );

  useEffect(() => {
    if (!isEditing || !recordId) return;

    const loadRecord = async () => {
      setLoading(true);
      const result =
        kind === "cif"
          ? await getCivilCifTransmittalRecordById(recordId)
          : await getCivilTransmittalRecordById(recordId);

      if (!result.success || !result.result) {
        popup.showError(
          !result.success
            ? result.error || "Failed to load record"
            : "Failed to load record",
        );
        router.push(config.href);
        return;
      }

      setInitialValues(result.result as unknown as Record<string, unknown>);
      setLoading(false);
    };

    void loadRecord();
  }, [config.href, isEditing, kind, popup, recordId, router]);

  const handleSave = async (rows: Record<string, string>[]) => {
    if (!canManage) {
      return {
        success: false,
        error: "You do not have permission to save this record.",
      };
    }

    if (kind === "cif") {
      if (isEditing && recordId) {
        return updateCivilCifTransmittalRecord(recordId, rows[0]);
      }

      return rows.length === 1
        ? createCivilCifTransmittalRecord(rows[0])
        : createCivilCifTransmittalRecords(rows);
    }

    if (isEditing && recordId) {
      return updateCivilTransmittalRecord(recordId, rows[0]);
    }

    return rows.length === 1
      ? createCivilTransmittalRecord(rows[0])
      : createCivilTransmittalRecords(rows);
  };

  if (loading) {
    return <RedirectingUI titleText="Loading transmittal record..." />;
  }

  return (
    <SpreadsheetRecordFormPage
      title={pageTitle}
      breadcrumbRoot="Civil Cases"
      breadcrumbCurrent={config.title}
      subtitle={
        isEditing
          ? "Update the record details in the table below."
          : "Add records in a table, paste rows, or import them from Excel."
      }
      fields={spreadsheetFields}
      initialValues={initialValues}
      isEditing={isEditing}
      canManage={canManage}
      onBack={() => router.push(config.href)}
      onSave={handleSave}
      successMessage={
        isEditing ? "Record saved successfully" : "Records saved successfully"
      }
    />
  );
}
