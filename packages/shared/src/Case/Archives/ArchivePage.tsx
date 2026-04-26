"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiChevronRight,
  FiDownload,
  FiFilePlus,
  FiFolderPlus,
  FiGrid,
  FiSearch,
  FiUpload,
} from "react-icons/fi";
import { ArchiveEntryType } from "../../generated/prisma/enums";
import {
  useAdaptiveNavigation,
  useAdaptivePathname,
} from "../../lib/nextCompat";
import Roles from "../../lib/Roles";
import { usePopup } from "../../Popup/PopupProvider";
import { PageListSkeleton } from "../../Skeleton/SkeletonTable";
import StatsCard from "../../Stats/StatsCard";
import Pagination from "../../Table/Pagination";
import Table from "../../Table/Table";
import { ButtonStyles } from "../../Utils/ButtonStyles";
import type { ArchiveAdapter } from "./ArchiveAdapter";
import ArchiveRow from "./ArchiveRow";
import {
  normalizeArchivePath,
  type ArchiveEntryData,
  type ArchiveFilterOptions,
  type ArchiveStats,
} from "./ArchiveSchema";

const getCurrentQueryPath = (): string => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return normalizeArchivePath(params.get("path"));
};

const buildArchiveHref = (path: string): string => {
  const normalized = normalizeArchivePath(path);
  return normalized
    ? `/user/cases/archive?path=${encodeURIComponent(normalized)}`
    : "/user/cases/archive";
};

const ArchivePage: React.FC<{
  role: Roles;
  adapter: ArchiveAdapter;
}> = ({ role, adapter }) => {
  const router = useAdaptiveNavigation();
  const pathname = useAdaptivePathname();
  const statusPopup = usePopup();
  const canManage =
    role === Roles.ADMIN || role === Roles.ATTY || role === Roles.ARCHIVE;

  const [entries, setEntries] = useState<ArchiveEntryData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<ArchiveEntryType | "ALL">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: NonNullable<ArchiveFilterOptions["sortKey"]>;
    order: "asc" | "desc";
  }>({ key: "updatedAt", order: "desc" });
  const [stats, setStats] = useState<ArchiveStats>({
    totalItems: 0,
    folders: 0,
    editableItems: 0,
    uploadedFiles: 0,
  });

  const pageSize = 10;

  useEffect(() => {
    const syncPath = () => {
      setCurrentPath(getCurrentQueryPath());
    };

    syncPath();
    window.addEventListener("popstate", syncPath);
    window.addEventListener("hashchange", syncPath);

    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener("hashchange", syncPath);
    };
  }, [pathname]);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentPath, searchValue, sortConfig, typeFilter]);

  const filters = useMemo(
    () => ({
      parentPath: currentPath,
      search: searchValue.trim() || undefined,
      entryType: typeFilter === "ALL" ? undefined : typeFilter,
    }),
    [currentPath, searchValue, typeFilter],
  );

  const refreshEntries = useCallback(
    async (page = currentPage) => {
      try {
        const [listResult, statsResult] = await Promise.all([
          adapter.getArchiveEntriesPage({
            page,
            pageSize,
            filters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
          }),
          adapter.getArchiveStats({
            filters,
          }),
        ]);

        if (!listResult.success) {
          setError(listResult.error || "Failed to load archive entries");
          return;
        }

        setEntries(listResult.result.items);
        setTotalCount(
          listResult.result.total ?? listResult.result.items.length,
        );
        setError(null);

        if (statsResult.success && statsResult.result) {
          setStats(statsResult.result);
        }
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load archive entries",
        );
      } finally {
        setLoading(false);
      }
    },
    [adapter, currentPage, filters, pageSize, sortConfig],
  );

  useEffect(() => {
    void refreshEntries(currentPage);
  }, [currentPage, refreshEntries]);

  const handleSort = (key: NonNullable<ArchiveFilterOptions["sortKey"]>) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const handleOpen = (entry: ArchiveEntryData) => {
    if (entry.entryType === ArchiveEntryType.FOLDER) {
      router.push(buildArchiveHref(entry.fullPath));
      return;
    }

    router.push(`/user/cases/archive/${entry.id}`);
  };

  const handleEdit = (entry: ArchiveEntryData) => {
    router.push(`/user/cases/archive/edit?id=${entry.id}`);
  };

  const handleDownload = async (entry: ArchiveEntryData) => {
    const result = await adapter.getArchiveFileUrl(entry.id, {
      inline: false,
      fileName: entry.name,
      contentType: entry.file?.mimeType ?? undefined,
    });

    if (!result.success) {
      statusPopup.showError(result.error || "Failed to download file");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = result.result;
    anchor.download = entry.name;
    anchor.click();
  };

  const handleDelete = async (entry: ArchiveEntryData) => {
    const confirmed = await statusPopup.showConfirm(
      entry.entryType === ArchiveEntryType.FOLDER
        ? `Delete folder "${entry.name}" and all of its contents?`
        : `Delete "${entry.name}" from the archive?`,
    );

    if (!confirmed) return;

    const result = await adapter.deleteArchiveEntry(entry.id);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete archive entry");
      return;
    }

    statusPopup.showSuccess("Archive entry deleted");
    await refreshEntries();
  };

  const breadcrumbSegments = useMemo(() => {
    const normalized = normalizeArchivePath(currentPath);
    if (!normalized) return [];

    const segments = normalized.split("/");
    return segments.map((segment, index) => ({
      label: segment,
      path: segments.slice(0, index + 1).join("/"),
    }));
  }, [currentPath]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={6} tableRows={8} />;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-base font-bold text-base-content mb-1">
                <span>Cases</span>
                <span className="text-base-content/30">/</span>
                <span className="text-base-content/70 font-medium">
                  Archive Explorer
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Archive Explorer
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/50">
                <FiCalendar className="shrink-0" />
                <span>
                  Manage folders, uploaded files, editable documents, and
                  spreadsheets
                </span>
              </p>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  className={ButtonStyles.secondary}
                  onClick={() =>
                    router.push(
                      `/user/cases/archive/add?template=folder&path=${encodeURIComponent(currentPath)}`,
                    )
                  }
                >
                  <FiFolderPlus className="h-5 w-5" />
                  New Folder
                </button>
                <button
                  className={ButtonStyles.info}
                  onClick={() =>
                    router.push(
                      `/user/cases/archive/add?template=document&path=${encodeURIComponent(currentPath)}`,
                    )
                  }
                >
                  <FiFilePlus className="h-5 w-5" />
                  New Document
                </button>
                <button
                  className="btn btn-md btn-outline btn-success gap-2"
                  onClick={() =>
                    router.push(
                      `/user/cases/archive/add?template=spreadsheet&path=${encodeURIComponent(currentPath)}`,
                    )
                  }
                >
                  <FiGrid className="h-5 w-5" />
                  New Spreadsheet
                </button>
                <button
                  className={ButtonStyles.primary}
                  onClick={() =>
                    router.push(
                      `/user/cases/archive/add?template=file&path=${encodeURIComponent(currentPath)}`,
                    )
                  }
                >
                  <FiUpload className="h-5 w-5" />
                  Upload File
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          label="TOTAL ITEMS"
          value={stats.totalItems.toLocaleString()}
          subtitle="Visible in the current view"
          icon={
            FiFolderPlus as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={0}
        />
        <StatsCard
          label="FOLDERS"
          value={stats.folders.toLocaleString()}
          subtitle="Folder-based organization"
          icon={
            FiFolderPlus as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={100}
        />
        <StatsCard
          label="EDITABLE"
          value={stats.editableItems.toLocaleString()}
          subtitle="Documents and spreadsheets"
          icon={
            FiFilePlus as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={200}
        />
        <StatsCard
          label="UPLOADED FILES"
          value={stats.uploadedFiles.toLocaleString()}
          subtitle="Stored binary attachments"
          icon={
            FiDownload as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={300}
        />
      </div>

      <div className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-lg z-10" />
            <input
              type="text"
              placeholder="Search file name, folder, or description..."
              className="input input-bordered w-full pl-11"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>

          <select
            className="select select-bordered"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as ArchiveEntryType | "ALL")
            }
          >
            <option value="ALL">All Types</option>
            <option value={ArchiveEntryType.FOLDER}>Folders</option>
            <option value={ArchiveEntryType.DOCUMENT}>Documents</option>
            <option value={ArchiveEntryType.SPREADSHEET}>Spreadsheets</option>
            <option value={ArchiveEntryType.FILE}>Files</option>
          </select>

          <button
            type="button"
            className="btn btn-md btn-outline"
            onClick={() => router.push("/user/cases/archive")}
            disabled={!currentPath}
          >
            Root
          </button>

          <button
            type="button"
            className="btn btn-md btn-outline"
            onClick={() =>
              router.push(
                buildArchiveHref(currentPath.split("/").slice(0, -1).join("/")),
              )
            }
            disabled={!currentPath}
          >
            Up One Level
          </button>
        </div>

        <div className="rounded-2xl border border-base-200 bg-base-200/20 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-base-content/40 mb-2">
            <span>Current Path</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => router.push("/user/cases/archive")}
            >
              Root
            </button>
            {breadcrumbSegments.map((segment) => (
              <React.Fragment key={segment.path}>
                <FiChevronRight className="h-3.5 w-3.5 text-base-content/40" />
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={() => router.push(buildArchiveHref(segment.path))}
                >
                  {segment.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200 shadow-lg">
        <Table
          headers={[
            { key: "name", label: "Name", sortable: true },
            {
              key: "entryType",
              label: "Type",
              sortable: true,
              align: "center",
            },
            { key: "description", label: "Description" },
            { key: "size", label: "Size", align: "center" },
            {
              key: "updatedAt",
              label: "Updated",
              sortable: true,
              align: "center",
            },
            { key: "actions", label: "Actions", align: "center" },
          ]}
          data={entries as unknown as Record<string, unknown>[]}
          showPagination={false}
          resizableColumns
          disableCellTooltips={false}
          minColumnWidth={90}
          sortConfig={{ key: sortConfig.key, order: sortConfig.order }}
          onSort={(key) =>
            handleSort(key as NonNullable<ArchiveFilterOptions["sortKey"]>)
          }
          renderRow={(entry) => (
            <ArchiveRow
              key={(entry as ArchiveEntryData).id}
              entry={entry as ArchiveEntryData}
              canManage={canManage}
              onOpen={handleOpen}
              onEdit={handleEdit}
              onDelete={(item) => void handleDelete(item)}
              onDownload={(item) => void handleDownload(item)}
            />
          )}
        />
      </div>

      {entries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-10 text-center text-base-content/55">
          <p className="text-lg font-semibold">This folder is empty.</p>
          <p className="mt-1 text-sm">
            Create a folder, upload a file, or start a new editable document.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-base-content/40">
          Showing page {currentPage} of {pageCount}
        </p>
        <Pagination
          pageCount={pageCount}
          currentPage={currentPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
    </div>
  );
};

export default ArchivePage;
