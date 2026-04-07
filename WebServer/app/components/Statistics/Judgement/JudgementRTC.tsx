"use client";

import { useEffect, useState } from "react";
import {
    createRegionalJudgement,
    deleteRegionalJudgement,
    getRegionalJudgements,
    updateRegionalJudgement,
} from "./judgementActions";
import { rtcColumns } from "./JudgementColumnDef";
import { rtcJudgementFields } from "./JudgementFieldConfig";
import { RTCJudgementLog } from "./JudgementRecord";
import JudgementTable from "./JudgementTable";

interface JudgementRTCProps {
  selectedYear?: string;
  onSelectedYearChange?: (year: string) => void;
  requestAdd?: number;
  onDataReady?: (data: Record<string, unknown>[]) => void;
  onActivePageChange?: (active: boolean) => void;
  activeView?: string;
  onSwitchView?: (view: string) => void;
}

const JudgementRTC = ({
  selectedYear,
  onSelectedYearChange,
  requestAdd,
  onDataReady,
  onActivePageChange,
  activeView,
  onSwitchView,
}: JudgementRTCProps) => {
  const [records, setRecords] = useState<RTCJudgementLog[]>([]);

  async function loadRecords() {
    const res = await getRegionalJudgements();
    if (res.success) setRecords(res.result);
  }

  useEffect(() => {
    const load = async () => {
      await loadRecords();
    };
    void load();
  }, []);

  useEffect(() => {
    if (onDataReady)
      onDataReady(records as unknown as Record<string, unknown>[]);
  }, [records, onDataReady]);

  return (
    <JudgementTable<RTCJudgementLog & Record<string, unknown>>
      title="RTC Judgment Week"
      subtitle="Regional Trial Court — Nationwide Judgment Week Summary Report"
      data={records as (RTCJudgementLog & Record<string, unknown>)[]}
      columns={rtcColumns}
      fields={rtcJudgementFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      selectedYear={selectedYear}
      requestAdd={requestAdd}
      onChange={(data) => setRecords(data as RTCJudgementLog[])}
      onAdd={async (record) => {
        const res = await createRegionalJudgement(record as RTCJudgementLog);
        if (!res.success) throw new Error(res.error || "Create failed");
        await loadRecords();
      }}
      onUpdate={async (record) => {
        const id = Number(record.id);
        if (!id) throw new Error("Missing record id");
        const res = await updateRegionalJudgement(
          id,
          record as RTCJudgementLog,
        );
        if (!res.success) throw new Error(res.error || "Update failed");
        await loadRecords();
      }}
      onDelete={async (id) => {
        const res = await deleteRegionalJudgement(id);
        if (!res.success) throw new Error(res.error || "Delete failed");
        await loadRecords();
      }}
      onSelectedYearChange={onSelectedYearChange}
      onActivePageChange={onActivePageChange}
      activeView={activeView}
      onSwitchView={onSwitchView}
    />
  );
};

export default JudgementRTC;
