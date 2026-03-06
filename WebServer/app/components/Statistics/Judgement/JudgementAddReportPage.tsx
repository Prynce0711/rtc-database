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
};

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
      fields={
        rest.activeView === "MTC" ? rtcJudgementFields : (rest as any).fields
      }
      columns={rest.activeView === "MTC" ? rtcColumns : (rest as any).columns}
      initialData={initialData}
      onBack={onBack}
      allowedViews={["MTC", "RTC"]}
      onSave={handleSave}
    />
  );
};

export default JudgementAddReportPage;
