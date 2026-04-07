"use client";

import { useEffect, useMemo, useState } from "react";
import {
    createMunicipalJudgement,
    deleteMunicipalJudgement,
    getMunicipalJudgements,
    updateMunicipalJudgement,
} from "./judgementActions";
import { rtcColumns } from "./JudgementColumnDef";
import { rtcJudgementFields } from "./JudgementFieldConfig";
import { MTCJudgementLog } from "./JudgementRecord";
import JudgementTable from "./JudgementTable";

type MtcDisplayRow = MTCJudgementLog & {
  summaryProc: number;
  casesDisposed: number;
  pdlCICL: number;
  pdlInC: number;
  pdlProbation: number;
  ciclM: number;
  ciclF: number;
  ciclV: number;
  ciclInC: number;
  fine: number;
};

interface JudgementMTCProps {
  selectedYear?: string;
  onSelectedYearChange?: (year: string) => void;
  requestAdd?: number;
  onDataReady?: (data: Record<string, unknown>[]) => void;
  onActivePageChange?: (active: boolean) => void;
  activeView?: string;
  onSwitchView?: (view: string) => void;
}

const JudgementMTC = ({
  selectedYear,
  onSelectedYearChange,
  requestAdd,
  onDataReady,
  onActivePageChange,
  activeView,
  onSwitchView,
}: JudgementMTCProps) => {
  const [records, setRecords] = useState<MTCJudgementLog[]>([]);

  const tableRecords = useMemo<MtcDisplayRow[]>(
    () =>
      records.map((record) => ({
        ...record,
        summaryProc: 0,
        casesDisposed: Number(record.totalDisposed ?? 0),
        pdlCICL: 0,
        pdlInC: Number(record.pdlI ?? 0),
        pdlProbation: Number(record.pdlOthers ?? 0),
        ciclM: 0,
        ciclF: 0,
        ciclV: 0,
        ciclInC: 0,
        fine: 0,
      })),
    [records],
  );

  async function loadRecords() {
    const res = await getMunicipalJudgements();
    if (res.success) setRecords(res.result);
  }

  useEffect(() => {
    const load = async () => {
      await loadRecords();
    };
    void load();
  }, []);

  useEffect(() => {
    if (onDataReady) {
      onDataReady(tableRecords as unknown as Record<string, unknown>[]);
    }
  }, [tableRecords, onDataReady]);

  return (
    <JudgementTable<MtcDisplayRow & Record<string, unknown>>
      title="MTC Judgment Week"
      subtitle="Municipal Trial Court — Nationwide Judgment Week Summary Report"
      data={tableRecords as (MtcDisplayRow & Record<string, unknown>)[]}
      columns={rtcColumns}
      fields={rtcJudgementFields}
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
      onSelectedYearChange={onSelectedYearChange}
      onActivePageChange={onActivePageChange}
      activeView={activeView}
      onSwitchView={onSwitchView}
    />
  );
};

export default JudgementMTC;
