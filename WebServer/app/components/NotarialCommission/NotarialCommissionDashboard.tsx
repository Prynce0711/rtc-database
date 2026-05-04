"use client";

import {
  deleteNotarialCommission,
  getNotarialCommissions,
} from "@/app/components/NotarialCommission/NotarialCommissionActions";
import {
  exportNotarialCommissionsExcel,
  uploadNotarialCommissionExcel,
} from "@/app/components/NotarialCommission/ExcelActions";
import {
  ExactMatchMap,
  FilterDropdown,
  FilterOption,
  FilterValues,
  PageListSkeleton,
  usePopup,
} from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiDownload,
  FiFileText,
  FiFilter,
  FiHash,
  FiMapPin,
  FiPlus,
  FiSearch,
  FiUpload,
} from "react-icons/fi";
import NotarialCommissionTable from "./NotarialCommissionTable";
import {
  getCommissionYearLabel,
  NotarialCommissionRecord,
  yearMatchesCommission,
} from "./schema";

type SuggestionTextKey = "petition" | "name" | "termOfCommission" | "address";

const suggestionTextKeys: SuggestionTextKey[] = [
  "petition",
  "name",
  "termOfCommission",
  "address",
];

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const downloadExcel = (base64: string, fileName: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const matchesText = (
  itemValue: string | null | undefined,
  filterValue: string,
  exact: boolean,
): boolean => {
  if (!itemValue) return false;
  const itemText = itemValue.toLowerCase();
  const filterText = filterValue.toLowerCase();
  return exact ? itemText === filterText : itemText.includes(filterText);
};

const NotarialCommissionDashboard: React.FC = () => {
  const router = useRouter();
  const statusPopup = usePopup();
  const [records, setRecords] = useState<NotarialCommissionRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({});
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const result = await getNotarialCommissions();
      if (!result.success) {
        statusPopup.showError(
          result.error ?? "Failed to load notarial commissions",
        );
        setError(result.error ?? "Failed to load notarial commissions");
        return;
      }

      setRecords(result.result);
      setError(null);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to load notarial commissions"));
    } finally {
      setLoading(false);
    }
  };

  const filterOptions: FilterOption[] = [
    { key: "petition", label: "Petition", type: "text" },
    { key: "name", label: "Name", type: "text" },
    {
      key: "termOfCommission",
      label: "Term of Commission",
      type: "text",
    },
    { key: "year", label: "Date / Year", type: "text" },
    { key: "address", label: "Address", type: "text" },
  ];

  const applyFilters = (
    filters: FilterValues,
    list: NotarialCommissionRecord[],
    exactMap: ExactMatchMap,
  ) => {
    return list.filter((record) => {
      if (
        typeof filters.petition === "string" &&
        filters.petition.trim() !== "" &&
        !matchesText(
          record.petition,
          filters.petition,
          exactMap.petition ?? false,
        )
      ) {
        return false;
      }

      if (
        typeof filters.name === "string" &&
        filters.name.trim() !== "" &&
        !matchesText(record.name, filters.name, exactMap.name ?? false)
      ) {
        return false;
      }

      if (
        typeof filters.termOfCommission === "string" &&
        filters.termOfCommission.trim() !== "" &&
        !matchesText(
          record.termOfCommission,
          filters.termOfCommission,
          exactMap.termOfCommission ?? false,
        )
      ) {
        return false;
      }

      if (
        typeof filters.year === "string" &&
        filters.year.trim() !== "" &&
        !yearMatchesCommission(
          filters.year,
          record.termStartYear,
          record.termEndYear,
          record.termOfCommission,
          exactMap.year ?? false,
        )
      ) {
        return false;
      }

      if (
        typeof filters.address === "string" &&
        filters.address.trim() !== "" &&
        !matchesText(record.address, filters.address, exactMap.address ?? false)
      ) {
        return false;
      }

      return true;
    });
  };

  const advancedFiltered = useMemo(
    () =>
      Object.keys(appliedFilters).length > 0
        ? applyFilters(appliedFilters, records, exactMatchMap)
        : records,
    [appliedFilters, exactMatchMap, records],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return advancedFiltered;

    const query = search.toLowerCase();
    return advancedFiltered.filter((record) => {
      const yearLabel = getCommissionYearLabel(
        record.termStartYear,
        record.termEndYear,
      );
      return [
        record.petition,
        record.name,
        record.termOfCommission,
        record.address,
        yearLabel,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query));
    });
  }, [advancedFiltered, search]);

  const analytics = useMemo(() => {
    const totalTerms = new Set(
      records.map((record) =>
        getCommissionYearLabel(record.termStartYear, record.termEndYear),
      ),
    ).size;
    const totalPetitions = new Set(records.map((record) => record.petition))
      .size;
    const totalAddresses = new Set(records.map((record) => record.address)).size;
    const missingDetectedYear = records.filter(
      (record) => !record.termStartYear && !record.termEndYear,
    ).length;

    return {
      totalRecords: records.length,
      totalTerms,
      totalPetitions,
      totalAddresses,
      missingDetectedYear,
    };
  }, [records]);

  const getSuggestions = (key: string, inputValue: string): string[] => {
    let values: string[] = [];

    if (key === "year") {
      values = records.flatMap((record) => {
        const label = getCommissionYearLabel(
          record.termStartYear,
          record.termEndYear,
        );
        const years = [record.termStartYear, record.termEndYear]
          .filter((year): year is number => typeof year === "number")
          .map(String);
        return [label, ...years];
      });
    } else if (suggestionTextKeys.includes(key as SuggestionTextKey)) {
      values = records
        .map((record) => record[key as SuggestionTextKey])
        .filter((value): value is string => !!value && value.length > 0);
    }

    const unique = Array.from(new Set(values)).sort();
    if (!inputValue) return unique;

    return unique.filter((value) =>
      value.toLowerCase().includes(inputValue.toLowerCase()),
    );
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMatchMapParam: ExactMatchMap,
  ) => {
    setAppliedFilters(filters);
    setExactMatchMap(exactMatchMapParam);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    (async () => {
      try {
        const result = await uploadNotarialCommissionExcel(file);
        const importPayload = result.success
          ? result.result
          : result.errorResult;

        if (importPayload?.failedExcel) {
          downloadExcel(
            importPayload.failedExcel.base64,
            importPayload.failedExcel.fileName,
          );
        }

        if (!result.success) {
          statusPopup.showError(
            result.error ?? "Failed to import notarial commissions",
          );
          return;
        }

        if ((importPayload?.meta.importedCount ?? 0) === 0) {
          statusPopup.showError(
            "No valid rows to import. Failed rows have been downloaded for review.",
          );
          return;
        }

        await fetchRecords();
        if (importPayload?.failedExcel) {
          statusPopup.showSuccess(
            "Import complete. Failed rows have been downloaded for review.",
          );
        } else {
          statusPopup.showSuccess("Notarial commissions imported successfully");
        }
      } catch (error) {
        statusPopup.showError(
          getErrorMessage(error, "Error importing notarial commissions"),
        );
      } finally {
        event.target.value = "";
      }
    })();
  };

  const handleExport = () => {
    (async () => {
      try {
        const result = await exportNotarialCommissionsExcel();
        if (!result.success) {
          statusPopup.showError(
            result.error ?? "Failed to export notarial commissions",
          );
          return;
        }
        if (!result.result) {
          statusPopup.showError("No data to export");
          return;
        }

        downloadExcel(result.result.base64, result.result.fileName);
      } catch (error) {
        statusPopup.showError(
          getErrorMessage(error, "Error exporting notarial commissions"),
        );
      }
    })();
  };

  const handleDelete = async (id: number) => {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this notarial commission?",
      ))
    ) {
      return;
    }

    const result = await deleteNotarialCommission(id);
    if (!result.success) {
      statusPopup.showError(result.error ?? "Unable to delete record");
      return;
    }

    setRecords((prev) => prev.filter((record) => record.id !== id));
    setSelectedIds((prev) => prev.filter((recordId) => recordId !== id));
    statusPopup.showSuccess("Notarial commission deleted successfully");
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    if (
      !(await statusPopup.showConfirm(
        `Delete ${selectedIds.length} selected notarial commission${selectedIds.length > 1 ? "s" : ""}?`,
      ))
    ) {
      return;
    }

    setDeletingSelected(true);
    statusPopup.showLoading("Deleting selected notarial commissions...");

    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => deleteNotarialCommission(id)),
      );
      const deletedIds = selectedIds.filter((id, index) => {
        const result = results[index];
        return result.status === "fulfilled" && result.value.success;
      });

      setRecords((prev) =>
        prev.filter((record) => !deletedIds.includes(record.id)),
      );
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));

      if (deletedIds.length === selectedIds.length) {
        statusPopup.showSuccess("Selected notarial commissions deleted.");
      } else {
        statusPopup.showError(
          `Deleted ${deletedIds.length}, but failed to delete ${selectedIds.length - deletedIds.length}.`,
        );
      }
    } finally {
      setDeletingSelected(false);
    }
  };

  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={7} tableRows={8} />;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="w-full max-w-500 mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Notarial Commission
          </h1>
        </div>

        <div className="relative mb-8">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl" />
              <input
                className="input input-bordered input-lg w-full pl-14 text-base rounded-lg shadow-sm"
                placeholder="Search petition, name, term, address..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`btn btn-md btn-outline flex items-center gap-2 ${
                  Object.keys(appliedFilters).length > 0 ? "btn-active" : ""
                }`}
                onClick={() => setFilterModalOpen(true)}
              >
                <FiFilter size={18} />
                <span className="hidden sm:inline">Filters</span>
              </button>

              <label className="btn btn-md btn-outline flex items-center gap-2">
                <FiUpload size={18} />
                <span className="hidden sm:inline">Import</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={handleImport}
                />
              </label>

              <button
                className="btn btn-md btn-outline flex items-center gap-2"
                onClick={handleExport}
              >
                <FiDownload size={18} />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                className="btn btn-md btn-primary flex items-center gap-2"
                onClick={() => router.push("/user/notarial-commission/add")}
              >
                <FiPlus size={18} />
                <span className="hidden sm:inline">Add Report</span>
              </button>
            </div>
          </div>

          <FilterDropdown
            isOpen={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            options={filterOptions}
            onApply={handleApplyFilters}
            searchValue={appliedFilters}
            getSuggestions={getSuggestions}
          />
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              {
                label: "Total Records",
                value: analytics.totalRecords,
                subtitle: `${analytics.totalTerms} term periods`,
                icon: FiFileText,
              },
              {
                label: "Petitions",
                value: analytics.totalPetitions,
                subtitle: "Unique petition entries",
                icon: FiHash,
              },
              {
                label: "Addresses",
                value: analytics.totalAddresses,
                subtitle: "Unique addresses",
                icon: FiMapPin,
              },
              {
                label: "No Year Detected",
                value: analytics.missingDetectedYear,
                subtitle: "Missing term year",
                icon: FiCalendar,
              },
            ].map((card, index) => {
              const Icon = card.icon as React.ComponentType<
                React.SVGProps<SVGSVGElement>
              >;
              return (
                <div
                  key={card.label}
                  className="transform hover:scale-105 card surface-card-hover group"
                  style={{
                    transitionDelay: `${index * 100}ms`,
                    transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  <div
                    className="card-body relative overflow-hidden"
                    style={{ padding: "var(--space-card-padding)" }}
                  >
                    <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
                      <Icon className="h-full w-full" />
                    </div>
                    <div className="relative text-center">
                      <div className="mb-3">
                        <span className="text-sm font-semibold text-muted">
                          {card.label}
                        </span>
                      </div>
                      <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                        {card.value}
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-muted">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-primary">
                    {selectedIds.length} record
                    {selectedIds.length > 1 ? "s" : ""} selected
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        router.push(
                          `/user/notarial-commission/edit?ids=${selectedIds.join(",")}`,
                        )
                      }
                    >
                      Edit Selected
                    </button>
                    <button
                      className={`btn btn-sm btn-error btn-outline ${
                        deletingSelected ? "loading" : ""
                      }`}
                      onClick={handleDeleteSelected}
                      disabled={deletingSelected}
                    >
                      Delete Selected
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setSelectedIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="rounded-2xl shadow-lg border border-base-100 overflow-visible">
            <NotarialCommissionTable
              records={filtered}
              onEdit={(record) =>
                router.push(`/user/notarial-commission/edit?id=${record.id}`)
              }
              onDelete={handleDelete}
              selectedIds={selectedIds}
              onToggleSelect={(id) =>
                setSelectedIds((prev) =>
                  prev.includes(id)
                    ? prev.filter((recordId) => recordId !== id)
                    : [...prev, id],
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotarialCommissionDashboard;
