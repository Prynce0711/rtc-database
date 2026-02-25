"use client";

import { useState } from "react";
import { courtColumns } from "./AnnualColumnDef";
import { courtLogFields } from "./AnnualFieldConfig";
import { CourtLog } from "./AnnualRecord";
import AnnualTable from "./AnnualTable";

/**
 * MTC (Municipal Trial Court) Receiving Log
 * Uses the shared AnnualTable with court column / field configs.
 */
const MTC = () => {
  const [records, setRecords] = useState<CourtLog[]>([]);

  return (
    <AnnualTable<CourtLog & Record<string, unknown>>
      title="MTC Receiving Log"
      subtitle="Municipal Trial Court — Track all received documents and case filings"
      data={records as (CourtLog & Record<string, unknown>)[]}
      columns={courtColumns}
      fields={courtLogFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      onChange={(data) => setRecords(data as CourtLog[])}
    />
  );
};

export default MTC;
