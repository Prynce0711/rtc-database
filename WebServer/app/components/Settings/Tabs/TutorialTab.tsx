"use client";

import { useEffect, useState } from "react";
import { FiCheckCircle, FiPlayCircle, FiRefreshCcw, FiXCircle } from "react-icons/fi";
import {
  getTutorialProgress,
  startTutorial,
  type TutorialProgress,
} from "../../Tutorial/TutorialActions";
import { TUTORIAL_RESTART_EVENT } from "../../Tutorial/TutorialEvents";
import { SettingsCard, SettingsRow } from "../SettingsPrimitives";

const formatDateTime = (value: string | null) => {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const getStatusIcon = (status: TutorialProgress["status"]) => {
  if (status === "COMPLETED") return <FiCheckCircle className="text-success" />;
  if (status === "SKIPPED") return <FiXCircle className="text-warning" />;
  return <FiPlayCircle className="text-primary" />;
};

const getStatusText = (status: TutorialProgress["status"]) => {
  if (status === "COMPLETED") return "Completed";
  if (status === "SKIPPED") return "Canceled";
  return "Ready to run";
};

const TutorialTab = () => {
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let mounted = true;

    void getTutorialProgress().then((result) => {
      if (!mounted) return;
      if (result.success) {
        setProgress(result.result);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleRestart = async () => {
    setStarting(true);
    try {
      const result = await startTutorial();
      if (result.success) {
        setProgress(result.result);
        window.dispatchEvent(new Event(TUTORIAL_RESTART_EVENT));
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6" data-tour="settings-tutorial-card">
      <SettingsCard
        title="Tutorial"
        description="Review your walkthrough status or restart the guided tour."
      >
        <SettingsRow
          label="Current Status"
          description="Completed or canceled tutorials stay hidden until you restart them."
        >
          <div className="inline-flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm font-semibold min-w-40">
            {loading || !progress ? (
              <span className="loading loading-spinner loading-xs text-primary" />
            ) : (
              <>
                {getStatusIcon(progress.status)}
                <span>{getStatusText(progress.status)}</span>
              </>
            )}
          </div>
        </SettingsRow>

        <SettingsRow label="Last Started" description="Most recent tutorial start time.">
          <p className="text-sm font-semibold text-base-content/65 min-w-48 text-right">
            {formatDateTime(progress?.lastStartedAt ?? null)}
          </p>
        </SettingsRow>

        <SettingsRow label="Last Completed" description="When you last finished the tour.">
          <p className="text-sm font-semibold text-base-content/65 min-w-48 text-right">
            {formatDateTime(progress?.completedAt ?? null)}
          </p>
        </SettingsRow>

        <SettingsRow label="Last Canceled" description="When you last canceled the tour.">
          <p className="text-sm font-semibold text-base-content/65 min-w-48 text-right">
            {formatDateTime(progress?.skippedAt ?? null)}
          </p>
        </SettingsRow>

        <div className="px-7 py-6 flex justify-end">
          <button
            type="button"
            onClick={handleRestart}
            disabled={loading || starting}
            data-tour="settings-restart-tutorial"
            className="btn btn-primary gap-2 rounded-xl min-w-44"
          >
            {starting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FiRefreshCcw size={16} />
            )}
            Restart Tutorial
          </button>
        </div>
      </SettingsCard>
    </div>
  );
};

export default TutorialTab;
