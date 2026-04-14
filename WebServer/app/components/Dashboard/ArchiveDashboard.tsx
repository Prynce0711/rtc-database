"use client";

import {
  getRecentArchiveFiles,
  type ArchiveRecentFile,
} from "@/app/components/Case/ReceivingLogs/RecievingLogsActions";
import { usePopup } from "@rtc-database/shared";
import { Archive, Clock3, ExternalLink, FileArchive } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import StaffDashboard from "./StaffDashboard";

interface Props {
  staffId?: string;
}

const ArchiveDashboard: React.FC<Props> = ({ staffId }) => {
  const [recentFiles, setRecentFiles] = useState<ArchiveRecentFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const statusPopup = usePopup();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const loadRecentArchiveFiles = async () => {
      try {
        const result = await getRecentArchiveFiles(5);
        if (!active) return;

        if (result.success) {
          setRecentFiles(result.result);
        } else {
          statusPopup.showError(result.error || "Failed to load archive files");
        }
      } catch (error) {
        console.error("Failed to load recent archive files", error);
        if (active) {
          statusPopup.showError("Failed to load archive files");
        }
      } finally {
        if (active) {
          setLoadingFiles(false);
        }
      }
    };

    loadRecentArchiveFiles();

    return () => {
      active = false;
    };
  }, [statusPopup]);

  const recentSection = (
    <div className="card-body p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-base-content flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Recent Archive Files
          </h2>
          <p className="text-sm text-base-content/60">
            Latest document records received in archive logs
          </p>
        </div>
        <button
          className="btn btn-sm btn-outline btn-primary"
          onClick={() => router.push("/user/cases/receiving")}
          type="button"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Archives
        </button>
      </div>

      {loadingFiles ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-16 rounded-xl bg-base-200 animate-pulse" />
          ))}
        </div>
      ) : recentFiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-base-300 p-6 text-center text-base-content/60">
          No archive files uploaded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {recentFiles.map((file) => (
            <div
              key={file.id}
              className="rounded-xl border border-base-300/70 bg-base-100 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-base-content truncate flex items-center gap-2">
                    <FileArchive className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{file.fileName}</span>
                  </p>
                  <p className="text-xs text-base-content/60 mt-1 truncate">
                    {file.caseType}
                    {file.caseNumber ? ` - ${file.caseNumber}` : ""}
                    {file.branchNumber ? ` - Branch ${file.branchNumber}` : ""}
                  </p>
                </div>
                <span className="badge badge-outline text-xs whitespace-nowrap">
                  {new Date(file.uploadedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 text-xs text-base-content/55 flex items-center gap-1.5">
                <Clock3 className="h-3 w-3" />
                Received: {file.dateRecieved ? new Date(file.dateRecieved).toLocaleDateString() : "N/A"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <StaffDashboard
      staffId={staffId}
      dashboardTitle="Archive Dashboard"
      dashboardSubtitle="Manage archived and receiving log cases"
      loadingTitle="Loading Archive Dashboard"
      loadingSubtitle="Fetching archive case data..."
      viewAllPath="/user/cases/receiving"
      showRecentCases={false}
      recentSection={recentSection}
    />
  );
};

export default ArchiveDashboard;
