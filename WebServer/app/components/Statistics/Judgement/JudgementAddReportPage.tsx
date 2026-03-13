"use client";

import React from "react";
import { usePopup } from "../../Popup/PopupProvider";
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
const _pick = (names: string[]) =>
  rtcJudgementFields.filter((f) => names.includes(f.name));

const judgementTabs = [
  {
    label: "Location",
    fields: _pick(["branchNo"]),
  },
  {
    label: "Cases Heard",
    fields: _pick([
      "civilV",
      "civilInC",
      "criminalV",
      "criminalInC",
      "totalHeard",
    ]),
  },
  {
    label: "Cases Disposed",
    fields: _pick([
      "disposedCivil",
      "disposedCrim",
      "summaryProc",
      "casesDisposed",
    ]),
  },
  {
    label: "PDL Snapshot",
    fields: _pick(["pdlM", "pdlF", "pdlCICL"]),
  },
  {
    label: "PDL Release Flow",
    fields: _pick([
      "pdlV",
      "pdlInC",
      "pdlBail",
      "pdlRecognizance",
      "pdlMinRor",
    ]),
  },
  {
    label: "PDL Release Outcomes",
    fields: _pick([
      "pdlMaxSentence",
      "pdlDismissal",
      "pdlAcquittal",
      "pdlMinSentence",
      "pdlProbation",
    ]),
  },
  {
    label: "CICL Metrics",
    fields: _pick(["ciclM", "ciclF", "ciclV", "ciclInC"]),
  },
  {
    label: "Totals",
    fields: _pick(["pdlTotal", "fine", "total"]),
  },
].filter((t) => t.fields.length > 0);

const JudgementAddReportPage: React.FC<JudgementAddProps> = ({
  onAdd,
  onUpdate,
  initialData,
  onBack,
  ...rest
}) => {
  const statusPopup = usePopup();

  const handleSave = async (rows: Record<string, unknown>[]) => {
    if (initialData && initialData.length > 0) {
      // update mode
      if (onUpdate) {
        for (const record of rows) {
          await onUpdate(record);
        }
      }
      statusPopup.showSuccess(`${rows.length} entry(s) updated successfully`);
    } else {
      // add mode
      if (onAdd) {
        for (const record of rows) {
          await onAdd(record);
        }
      }
      statusPopup.showSuccess(`${rows.length} entry(s) added successfully`);
    }

    // go back to parent view
    onBack();
  };

  return (
    <AnnualAddReportPage
      {...(rest as AnnualAddReportPageProps)}
      // If user is adding in MTC view for Judgement, use RTC's field/column
      // layout so the tabs and numeric grouping match the RTC add experience.
      fields={rest.activeView === "MTC" ? rtcJudgementFields : rest.fields}
      columns={rest.activeView === "MTC" ? rtcColumns : rest.columns}
      customTabs={judgementTabs}
      initialData={initialData}
      onBack={onBack}
      allowedViews={["MTC", "RTC"]}
      onSave={handleSave}
    />
  );
};

export default JudgementAddReportPage;
