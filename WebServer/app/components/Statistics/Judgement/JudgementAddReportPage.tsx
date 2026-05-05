"use client";

import React from "react";
import { usePopup } from "@rtc-database/shared";
import AnnualAddReportPage, {
  AnnualAddReportPageProps,
} from "../Annual/AnnualAddReportPage";
import { rtcColumns } from "./JudgementColumnDef";
import { rtcJudgementFields } from "./JudgementFieldConfig";

type JudgementAddProps = Omit<AnnualAddReportPageProps, "onSave"> & {
  onAdd?: (record: Record<string, unknown>) => void | Promise<void>;
  onUpdate?: (record: Record<string, unknown>) => void | Promise<void>;
  fields?: typeof rtcJudgementFields;
  columns?: typeof rtcColumns;
};

/* ---------------------------------------------------------------
   Explicit tabs for Judgement add pages.
   Splits the auto-computed "Case Metrics" (9 fields) into
   "Cases Heard" + "Cases Disposed" so neither tab needs scrolling.
--------------------------------------------------------------- */
const buildJudgementTabs = (allFields: AnnualAddReportPageProps["fields"]) => {
  const pick = (names: string[]) =>
    allFields.filter((field) => names.includes(field.name));

  const allFieldOrder = [
    "branchNo",
    "civilV",
    "civilInC",
    "criminalV",
    "criminalInC",
    "totalHeard",
    "disposedCivil",
    "disposedCrim",
    "summaryProc",
    "casesDisposed",
    "totalDisposed",
    "pdlM",
    "pdlF",
    "pdlCICL",
    "pdlTotal",
    "pdlV",
    "pdlInC",
    "pdlI",
    "pdlBail",
    "pdlRecognizance",
    "pdlMinRor",
    "pdlMaxSentence",
    "pdlDismissal",
    "pdlAcquittal",
    "pdlMinSentence",
    "pdlProbation",
    "pdlOthers",
    "ciclM",
    "ciclF",
    "ciclV",
    "ciclInC",
    "fine",
    "total",
  ];

  return [
    {
      label: "All Fields",
      fields: pick(allFieldOrder),
    },
    {
      label: "Location",
      fields: pick(["branchNo"]),
    },
    {
      label: "Cases Heard",
      fields: pick([
        "civilV",
        "civilInC",
        "criminalV",
        "criminalInC",
        "totalHeard",
      ]),
    },
    {
      label: "Cases Disposed",
      fields: pick([
        "disposedCivil",
        "disposedCrim",
        "summaryProc",
        "casesDisposed",
        "totalDisposed",
      ]),
    },
    {
      label: "PDL Snapshot",
      fields: pick(["pdlM", "pdlF", "pdlCICL"]),
    },
    {
      label: "PDL Release Flow",
      fields: pick([
        "pdlV",
        "pdlInC",
        "pdlI",
        "pdlBail",
        "pdlRecognizance",
        "pdlMinRor",
      ]),
    },
    {
      label: "PDL Release Outcomes",
      fields: pick([
        "pdlMaxSentence",
        "pdlDismissal",
        "pdlAcquittal",
        "pdlMinSentence",
        "pdlProbation",
        "pdlOthers",
      ]),
    },
    {
      label: "CICL Metrics",
      fields: pick(["ciclM", "ciclF", "ciclV", "ciclInC"]),
    },
    {
      label: "Totals",
      fields: pick(["pdlTotal", "fine", "total"]),
    },
  ].filter((tab) => tab.fields.length > 0);
};

const JudgementAddReportPage: React.FC<JudgementAddProps> = ({
  onAdd,
  onUpdate,
  initialData,
  onBack,
  ...rest
}) => {
  const statusPopup = usePopup();
  const isMtcView = rest.activeView === "MTC";
  const activeFields =
    (rest.fields as AnnualAddReportPageProps["fields"] | undefined) ??
    rtcJudgementFields;
  const activeColumns =
    (rest.columns as AnnualAddReportPageProps["columns"] | undefined) ??
    rtcColumns;
  const displayFields = isMtcView ? rtcJudgementFields : activeFields;
  const displayColumns = isMtcView ? rtcColumns : activeColumns;
  const judgementTabs = React.useMemo(
    () => buildJudgementTabs(displayFields),
    [displayFields],
  );

  const mapMtcRecordFromRtcLayout = (
    record: Record<string, unknown>,
  ): Record<string, unknown> => {
    const next = { ...record };

    if (next.pdlI == null && next.pdlInC != null) {
      next.pdlI = next.pdlInC;
    }

    if (next.totalDisposed == null && next.casesDisposed != null) {
      next.totalDisposed = next.casesDisposed;
    }

    if (next.pdlOthers == null && next.pdlProbation != null) {
      next.pdlOthers = next.pdlProbation;
    }

    return next;
  };

  const handleSave = async (rows: Record<string, unknown>[]) => {
    const rowsToPersist = isMtcView
      ? rows.map(mapMtcRecordFromRtcLayout)
      : rows;

    try {
      if (initialData && initialData.length > 0) {
        statusPopup.showLoading("Updating judgement report...");
        // update mode
        if (onUpdate) {
          for (const record of rowsToPersist) {
            await onUpdate(record);
          }
        }
        statusPopup.showSuccess(
          `${rowsToPersist.length} entry(s) updated successfully`,
        );
      } else {
        statusPopup.showLoading("Saving judgement report...");
        // add mode
        if (onAdd) {
          for (const record of rowsToPersist) {
            await onAdd(record);
          }
        }
        statusPopup.showSuccess(
          `${rowsToPersist.length} entry(s) added successfully`,
        );
      }

      // go back to parent view
      onBack();
    } catch (error) {
      statusPopup.showError(
        error instanceof Error ? error.message : "Failed to save report.",
      );
    }
  };

  return (
    <AnnualAddReportPage
      {...(rest as AnnualAddReportPageProps)}
      fields={displayFields}
      columns={displayColumns}
      yearFilterInputMode="select"
      customTabs={judgementTabs}
      initialData={initialData}
      onBack={onBack}
      allowedViews={["MTC", "RTC"]}
      onSave={handleSave}
    />
  );
};

export default JudgementAddReportPage;

