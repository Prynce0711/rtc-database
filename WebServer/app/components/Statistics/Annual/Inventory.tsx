"use client";

import {
  createInventoryDocument,
  deleteInventoryDocument,
  getInventoryDocuments,
  updateInventoryDocument,
} from "@/app/components/Statistics/Annual/AnnualActions";
import { InventoryDocumentSchema } from "@/app/components/Statistics/Annual/Schema";
import { useEffect, useMemo, useState } from "react";
import { AnyColumnDef, inventoryColumns } from "./AnnualColumnDef";
import { inventoryLogFields } from "./AnnualFieldConfig";
import { InventoryLog } from "./AnnualRecord";
import AnnualTable from "./AnnualTable";

export type InventoryCourtFilter = "RTC" | "MTC";

const normalizeCourtType = (
  value: unknown,
): InventoryCourtFilter | undefined => {
  const text = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!text) return undefined;
  if (text.includes("RTC")) return "RTC";
  if (text.includes("MTC")) return "MTC";
  return undefined;
};

const RTC_INVENTORY_CIVIL_HEADER = "CIVIL/SP. PROC./LRC";
const MTC_INVENTORY_CIVIL_HEADER = "CIVIL/SMALL CLAIMS";
const requiredInventoryFields = new Set([
  "region",
  "province",
  "court",
  "cityMunicipality",
  "branch",
]);

interface InventoryProps {
  selectedYear?: string;
  requestAdd?: number;
  courtFilter?: InventoryCourtFilter;
  onDataReady?: (data: Record<string, unknown>[]) => void;
  onActivePageChange?: (active: boolean) => void;
  activeView?: string;
  onSwitchView?: (view: string) => void;
}

/**
 * Inventory
 * Uses the shared AnnualTable with inventory-specific column / field configs.
 */
const Inventory = ({
  selectedYear,
  requestAdd,
  courtFilter,
  onDataReady,
  onActivePageChange,
  activeView,
  onSwitchView,
}: InventoryProps) => {
  const [records, setRecords] = useState<InventoryLog[]>([]);
  const resolvedCourtFilter = courtFilter ?? "RTC";

  const filteredRecords = useMemo(() => {
    return records.filter(
      (record) => normalizeCourtType(record.court) === resolvedCourtFilter,
    );
  }, [records, resolvedCourtFilter]);

  const courtOptions = useMemo(() => {
    const existing = records
      .map((record) => String(record.court ?? "").trim())
      .filter((value) => value.length > 0);

    return Array.from(new Set(["RTC", "MTC", ...existing]));
  }, [records]);

  const inventoryFields = useMemo(
    () =>
      inventoryLogFields.map((field) =>
        field.name === "court"
          ? {
              ...field,
              type: "select" as const,
              required: true,
              options: courtOptions,
            }
          : requiredInventoryFields.has(field.name)
            ? {
                ...field,
                required: true,
              }
            : field,
      ),
    [courtOptions],
  );

  const inventoryTableColumns = useMemo<AnyColumnDef[]>(() => {
    const civilHeaderLabel =
      resolvedCourtFilter === "RTC"
        ? RTC_INVENTORY_CIVIL_HEADER
        : MTC_INVENTORY_CIVIL_HEADER;

    return inventoryColumns.map((column) => {
      if (!("children" in column)) {
        return column;
      }

      return {
        ...column,
        children: column.children.map((child) => {
          if (
            child.key !== "civilSmallClaimsFiled" &&
            child.key !== "civilSmallClaimsDisposed"
          ) {
            return child;
          }

          return {
            ...child,
            label: civilHeaderLabel,
          };
        }),
      };
    });
  }, [resolvedCourtFilter]);

  const inventoryTitle = useMemo(() => {
    const yearLabel = selectedYear ?? new Date().getFullYear().toString();
    return `INVENTORY OF FILED AND DISPOSED CASES FROM JANUARY TO DECEMBER ${yearLabel}`;
  }, [selectedYear]);

  const inventorySubtitle = useMemo(() => {
    if (resolvedCourtFilter === "RTC") {
      return "Regional Trial Court Inventory";
    }
    return "Municipal Trial Court Inventory";
  }, [resolvedCourtFilter]);

  useEffect(() => {
    let cancelled = false;

    const fetchRecords = async () => {
      const result = await getInventoryDocuments();
      if (!cancelled && result.success) {
        setRecords(result.result as unknown as InventoryLog[]);
      }
    };

    void fetchRecords();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadRecords() {
    const result = await getInventoryDocuments();
    if (result.success) setRecords(result.result as unknown as InventoryLog[]);
  }

  const handleAdd = async (record: Record<string, unknown>) => {
    const payload = !String(record.court ?? "").trim()
      ? { ...record, court: resolvedCourtFilter }
      : record;

    await createInventoryDocument(payload as InventoryDocumentSchema);
    await loadRecords();
  };

  const handleUpdate = async (record: Record<string, unknown>) => {
    const payload = !String(record.court ?? "").trim()
      ? { ...record, court: resolvedCourtFilter }
      : record;

    await updateInventoryDocument(
      record.id as number,
      payload as InventoryDocumentSchema,
    );
    await loadRecords();
  };

  const handleDelete = async (id: number) => {
    await deleteInventoryDocument(id);
    await loadRecords();
  };

  useEffect(() => {
    if (onDataReady)
      onDataReady(filteredRecords as unknown as Record<string, unknown>[]);
  }, [filteredRecords, onDataReady]);

  return (
    <AnnualTable<InventoryLog & Record<string, unknown>>
      title={inventoryTitle}
      subtitle={inventorySubtitle}
      variant="inventory"
      data={filteredRecords as (InventoryLog & Record<string, unknown>)[]}
      columns={inventoryTableColumns}
      fields={inventoryFields}
      dateKey="dateRecorded"
      sortDefaultKey="dateRecorded"
      selectedYear={selectedYear}
      requestAdd={requestAdd}
      onChange={(data) => setRecords(data as InventoryLog[])}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onActivePageChange={onActivePageChange}
      activeView={activeView}
      onSwitchView={onSwitchView}
    />
  );
};

export default Inventory;
