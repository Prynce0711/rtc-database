"use client";

import {
  getRecentNotarialFiles,
  type NotarialRecentFile,
} from "@/app/components/Case/Notarial/NotarialActions";
import { usePopup } from "@rtc-database/shared";
import { Clock3, ExternalLink, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import StaffDashboard from "./StaffDashboard";

interface Props {
  staffId?: string;
}

const NotarialDashboard: React.FC<Props> = ({ staffId }) => {
  const [recentFiles, setRecentFiles] = useState<NotarialRecentFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const statusPopup = usePopup();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const loadRecentNotarialFiles = async () => {
      try {
        const result = await getRecentNotarialFiles(5);
        if (!active) return;

        if (result.success) {
          setRecentFiles(result.result);
        } else {
          statusPopup.showError(result.error || "Failed to load notarial files");
        }
      } catch (error) {
        console.error("Failed to load recent notarial files", error);
        if (active) {
          statusPopup.showError("Failed to load notarial files");
        }
      } finally {
        if (active) {
          setLoadingFiles(false);
        }
      }
    };

    loadRecentNotarialFiles();

    return () => {
      active = false;
    };
  }, [statusPopup]);

  const recentSection = (
    <div className="card-body p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-base-content flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Notarial Files
          </h2>
          <p className="text-sm text-base-content/60">
            Latest uploaded files in notarial records
          </p>
        </div>
        <button
          className="btn btn-sm btn-outline btn-primary"
          onClick={() => router.push("/user/cases/notarial")}
          type="button"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Notarial
        </button>
      </div>

      {loadingFiles ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-16 rounded-xl bg-base-200 animate-pulse"
            />
          ))}
        </div>
      ) : recentFiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-base-300 p-6 text-center text-base-content/60">
          No notarial files uploaded yet.
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
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{file.fileName}</span>
                  </p>
                  <p className="text-xs text-base-content/60 mt-1 truncate">
                    {file.title || "Untitled"}
                    {file.attorney ? ` - ${file.attorney}` : ""}
                    {file.name ? ` - ${file.name}` : ""}
                  </p>
                </div>
                <span className="badge badge-outline text-xs whitespace-nowrap">
                  {new Date(file.uploadedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 text-xs text-base-content/55 flex items-center gap-1.5">
                <Clock3 className="h-3 w-3" />
                Uploaded: {new Date(file.uploadedAt).toLocaleString()}
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
      dashboardTitle="Notarial Dashboard"
      dashboardSubtitle="Manage notarial records and case updates"
      loadingTitle="Loading Notarial Dashboard"
      loadingSubtitle="Fetching notarial case data..."
      viewAllPath="/user/cases/notarial"
      showRecentCases={false}
      recentSection={recentSection}
    />
  );
};

export default NotarialDashboard;
