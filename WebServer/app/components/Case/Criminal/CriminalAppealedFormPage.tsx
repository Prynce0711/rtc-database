"use client";

import {
  CRIMINAL_APPEALED_CASE_FIELDS,
  RedirectingUI,
  Roles,
  usePopup,
} from "@rtc-database/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import SpreadsheetRecordFormPage, {
  type SpreadsheetRecordField,
} from "../Shared/SpreadsheetRecordFormPage";
import {
  createCriminalAppealedCase,
  createCriminalAppealedCases,
  getCriminalAppealedCaseById,
  updateCriminalAppealedCase,
} from "./CriminalAppealedActions";

const LIST_HREF = "/user/cases/criminal?view=appealed";

export default function CriminalAppealedFormPage({ role }: { role: Roles }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const popup = usePopup();
  const idParam = searchParams.get("id");
  const recordId = idParam ? Number(idParam) : null;
  const isEditing = Number.isInteger(recordId) && Number(recordId) > 0;
  const canManage = role === Roles.ADMIN || role === Roles.CRIMINAL;
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>();
  const [loading, setLoading] = useState(Boolean(isEditing));

  const pageTitle = useMemo(
    () => `${isEditing ? "Edit" : "Add"} Criminal Appealed Case`,
    [isEditing],
  );

  const spreadsheetFields = useMemo(
    () =>
      CRIMINAL_APPEALED_CASE_FIELDS.map(
        (field): SpreadsheetRecordField => ({
          key: field.key,
          label: field.label,
          type: field.type,
          placeholder: field.label,
          width: field.type === "date" ? 160 : undefined,
        }),
      ),
    [],
  );

  useEffect(() => {
    if (!isEditing || !recordId) return;

    const loadRecord = async () => {
      setLoading(true);
      const result = await getCriminalAppealedCaseById(recordId);

      if (!result.success || !result.result) {
        popup.showError(
          !result.success
            ? result.error || "Failed to load record"
            : "Failed to load record",
        );
        router.push(LIST_HREF);
        return;
      }

      setInitialValues(result.result as unknown as Record<string, unknown>);
      setLoading(false);
    };

    void loadRecord();
  }, [isEditing, popup, recordId, router]);

  const handleSave = async (rows: Record<string, string>[]) => {
    if (!canManage) {
      return {
        success: false,
        error: "You do not have permission to save this record.",
      };
    }

    if (isEditing && recordId) {
      return updateCriminalAppealedCase(recordId, rows[0]);
    }

    return rows.length === 1
      ? createCriminalAppealedCase(rows[0])
      : createCriminalAppealedCases(rows);
  };

  if (loading) {
    return <RedirectingUI titleText="Loading appealed case record..." />;
  }

  return (
    <SpreadsheetRecordFormPage
      title={pageTitle}
      breadcrumbRoot="Criminal Cases"
      breadcrumbCurrent="Appealed"
      subtitle={
        isEditing
          ? "Update the appealed case record in the table below."
          : "Add appealed case records in a table, paste rows, or import from Excel."
      }
      fields={spreadsheetFields}
      initialValues={initialValues}
      isEditing={isEditing}
      canManage={canManage}
      onBack={() => router.push(LIST_HREF)}
      onSave={handleSave}
      successMessage={
        isEditing ? "Record saved successfully" : "Records saved successfully"
      }
    />
  );
}
