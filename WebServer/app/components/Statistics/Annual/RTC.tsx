"use client";

import { useState } from "react";
import { courtColumns } from "./AnnualColumnDef";
import { courtLogFields } from "./AnnualFieldConfig";
import { CourtLog } from "./AnnualRecord";
import AnnualTable from "./AnnualTable";

/**
 * RTC (Regional Trial Court) Receiving Log
 * Uses the shared AnnualTable with court column / field configs.
 */
const RTC = () => {
  const [records, setRecords] = useState<CourtLog[]>([]);

  return (
    <AnnualTable<CourtLog & Record<string, unknown>>
      title="RTC Receiving Log"
      subtitle="Regional Trial Court — Track all received documents and case filings"
      data={records as (CourtLog & Record<string, unknown>)[]}
      columns={courtColumns}
      fields={courtLogFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      onChange={(data) => setRecords(data as CourtLog[])}
    />
  );
};

export default RTC;
