"use client";

import { useState } from "react";
import { inventoryColumns } from "./AnnualColumnDef";
import { inventoryLogFields } from "./AnnualFieldConfig";
import { InventoryLog } from "./AnnualRecord";
import AnnualTable from "./AnnualTable";

/**
 * Inventory
 * Uses the shared AnnualTable with inventory-specific column / field configs.
 */
const Inventory = () => {
  const [records, setRecords] = useState<InventoryLog[]>([]);

  return (
    <AnnualTable<InventoryLog & Record<string, unknown>>
      title="Inventory"
      subtitle="Court Document Inventory — Track all court documents and filings"
      data={records as (InventoryLog & Record<string, unknown>)[]}
      columns={inventoryColumns}
      fields={inventoryLogFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      onChange={(data) => setRecords(data as InventoryLog[])}
    />
  );
};

export default Inventory;
