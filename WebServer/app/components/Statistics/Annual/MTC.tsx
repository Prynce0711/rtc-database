"use client";

import {
  createMunicipalTrialCourt,
  deleteMunicipalTrialCourt,
  getMunicipalTrialCourts,
  updateMunicipalTrialCourt,
} from "@/app/components/Statistics/Annual/AnnualActions";
import { CaseSchema } from "@/app/components/Statistics/Annual/Schema";
import { useEffect, useState } from "react";
import { courtColumns } from "./AnnualColumnDef";
import { courtLogFields } from "./AnnualFieldConfig";
import { CourtLog } from "./AnnualRecord";
import AnnualTable from "./AnnualTable";

interface MTCProps {
  selectedYear?: string;
  requestAdd?: number;
  onDataReady?: (data: Record<string, unknown>[]) => void;
  onActivePageChange?: (active: boolean) => void;
  activeView?: string;
  onSwitchView?: (view: string) => void;
}

/**
 * MTC (Municipal Trial Court) Receiving Log
 * Uses the shared AnnualTable with court column / field configs.
 */
const MTC = ({
  selectedYear,
  requestAdd,
  onDataReady,
  onActivePageChange,
  activeView,
  onSwitchView,
}: MTCProps) => {
  const [records, setRecords] = useState<CourtLog[]>([]);

  async function loadRecords() {
    const result = await getMunicipalTrialCourts();
    if (result.success) setRecords(result.result as unknown as CourtLog[]);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const handleAdd = async (record: Record<string, unknown>) => {
    await createMunicipalTrialCourt(record as CaseSchema);
    await loadRecords();
  };

  const handleUpdate = async (record: Record<string, unknown>) => {
    await updateMunicipalTrialCourt(record.id as number, record as CaseSchema);
    await loadRecords();
  };

  const handleDelete = async (id: number) => {
    await deleteMunicipalTrialCourt(id);
    await loadRecords();
  };

  useEffect(() => {
    if (onDataReady)
      onDataReady(records as unknown as Record<string, unknown>[]);
  }, [records, onDataReady]);

  return (
    <AnnualTable<CourtLog & Record<string, unknown>>
      title="MTC Receiving Log"
      subtitle="Municipal Trial Court — Track all received documents and case filings"
      variant="court"
      data={records as (CourtLog & Record<string, unknown>)[]}
      columns={courtColumns}
      fields={courtLogFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      selectedYear={selectedYear}
      requestAdd={requestAdd}
      onChange={(data) => setRecords(data as CourtLog[])}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onActivePageChange={onActivePageChange}
      activeView={activeView}
      onSwitchView={onSwitchView}
    />
  );
};

export default MTC;
