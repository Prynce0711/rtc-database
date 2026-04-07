"use client";

import { useEffect, useState } from "react";
import {
  createMunicipalJudgement,
  deleteMunicipalJudgement,
  getMunicipalJudgements,
  updateMunicipalJudgement,
} from "./judgementActions";
import { mtcColumns } from "./JudgementColumnDef";
import { mtcJudgementFields } from "./JudgementFieldConfig";
import { MTCJudgementLog } from "./JudgementRecord";
import JudgementTable from "./JudgementTable";

interface JudgementMTCProps {
  selectedYear?: string;
  requestAdd?: number;
  onDataReady?: (data: Record<string, unknown>[]) => void;
  onActivePageChange?: (active: boolean) => void;
  activeView?: string;
  onSwitchView?: (view: string) => void;
}

const JudgementMTC = ({
  selectedYear,
  requestAdd,
  onDataReady,
  onActivePageChange,
  activeView,
  onSwitchView,
}: JudgementMTCProps) => {
  const [records, setRecords] = useState<MTCJudgementLog[]>([]);

  async function loadRecords() {
    const res = await getMunicipalJudgements();
    if (res.success) setRecords(res.result);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    if (onDataReady)
      onDataReady(records as unknown as Record<string, unknown>[]);
  }, [records, onDataReady]);

  return (
    <JudgementTable<MTCJudgementLog & Record<string, unknown>>
      // title="MTC Judgment Week"
      // subtitle="Municipal Trial Court — Nationwide Judgment Week Summary Report"
      data={records as (MTCJudgementLog & Record<string, unknown>)[]}
      columns={mtcColumns}
      fields={mtcJudgementFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      selectedYear={selectedYear}
      requestAdd={requestAdd}
      onChange={(data) => setRecords(data as MTCJudgementLog[])}
      onAdd={async (record) => {
        const res = await createMunicipalJudgement(record as MTCJudgementLog);
        if (!res.success) throw new Error(res.error || "Create failed");
        await loadRecords();
      }}
      onUpdate={async (record) => {
        const id = Number(record.id);
        if (!id) throw new Error("Missing record id");
        const res = await updateMunicipalJudgement(
          id,
          record as MTCJudgementLog,
        );
        if (!res.success) throw new Error(res.error || "Update failed");
        await loadRecords();
      }}
      onDelete={async (id) => {
        const res = await deleteMunicipalJudgement(id);
        if (!res.success) throw new Error(res.error || "Delete failed");
        await loadRecords();
      }}
      onActivePageChange={onActivePageChange}
      activeView={activeView}
      onSwitchView={onSwitchView}
    />
  );
};

export default JudgementMTC;
