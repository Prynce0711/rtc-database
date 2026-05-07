"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  completeTutorial,
  skipTutorial,
  startTutorial,
  type TutorialStatus,
} from "./TutorialActions";
import { TUTORIAL_RESTART_EVENT } from "./TutorialEvents";
import { getTutorialSteps } from "./tutorialSteps";

interface HighlightRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface AppTutorialProps {
  initialStatus: TutorialStatus;
  role: string;
}

const HIGHLIGHT_PADDING = 8;
const EDGE_GAP = 16;
const CARD_WIDTH = 420;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizePath = (path: string) => path.replace(/\/$/, "") || "/";

const getHighlightRect = (element: Element): HighlightRect => {
  const rect = element.getBoundingClientRect();
  const top = Math.max(EDGE_GAP, rect.top - HIGHLIGHT_PADDING);
  const left = Math.max(EDGE_GAP, rect.left - HIGHLIGHT_PADDING);
  const right = Math.min(
    window.innerWidth - EDGE_GAP,
    rect.right + HIGHLIGHT_PADDING,
  );
  const bottom = Math.min(
    window.innerHeight - EDGE_GAP,
    rect.bottom + HIGHLIGHT_PADDING,
  );

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

const getCardPosition = (rect: HighlightRect | null): CSSProperties => {
  if (!rect) {
    return {};
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(EDGE_GAP, viewportWidth - CARD_WIDTH - EDGE_GAP);

  if (rect.right + CARD_WIDTH + EDGE_GAP <= viewportWidth) {
    return {
      left: rect.right + EDGE_GAP,
      top: clamp(
        rect.top + rect.height / 2 - 170,
        EDGE_GAP,
        viewportHeight - 340,
      ),
    };
  }

  if (rect.left - CARD_WIDTH - EDGE_GAP >= 0) {
    return {
      left: rect.left - CARD_WIDTH - EDGE_GAP,
      top: clamp(
        rect.top + rect.height / 2 - 170,
        EDGE_GAP,
        viewportHeight - 340,
      ),
    };
  }

  const left = clamp(
    rect.left + rect.width / 2 - CARD_WIDTH / 2,
    EDGE_GAP,
    maxLeft,
  );

  if (rect.bottom + 300 + EDGE_GAP <= viewportHeight) {
    return { left, top: rect.bottom + EDGE_GAP };
  }

  if (rect.top - 300 - EDGE_GAP >= 0) {
    return { left, bottom: viewportHeight - rect.top + EDGE_GAP };
  }

  return {
    left,
    top: clamp(
      rect.top + rect.height / 2 - 170,
      EDGE_GAP,
      viewportHeight - 340,
    ),
  };
};

const clickSettingsTab = (tabId: string) => {
  const tab = document.querySelector<HTMLButtonElement>(
    `[data-tour="settings-tab-${tabId}"]`,
  );
  tab?.click();
};

const AppTutorial = ({ initialStatus, role }: AppTutorialProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const steps = useMemo(() => getTutorialSteps(role), [role]);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(initialStatus === "PENDING");
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<HighlightRect | null>(null);
  const [saving, setSaving] = useState(false);
  const startMarkedRef = useRef(false);

  const currentStep = steps[stepIndex] ?? steps[0];
  const isLastStep = stepIndex >= steps.length - 1;
  const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100);

  const beginTutorial = useCallback(async () => {
    if (startMarkedRef.current) return;
    startMarkedRef.current = true;
    await startTutorial();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialStatus !== "PENDING") return;
    setActive(true);
    void beginTutorial();
  }, [beginTutorial, initialStatus]);

  useEffect(() => {
    const handleRestart = () => {
      startMarkedRef.current = false;
      setStepIndex(0);
      setActive(true);
      void beginTutorial();
    };

    window.addEventListener(TUTORIAL_RESTART_EVENT, handleRestart);
    return () => {
      window.removeEventListener(TUTORIAL_RESTART_EVENT, handleRestart);
    };
  }, [beginTutorial]);

  useEffect(() => {
    if (!active || !currentStep?.route) return;

    if (normalizePath(pathname) !== normalizePath(currentStep.route)) {
      router.push(currentStep.route);
    }
  }, [active, currentStep, pathname, router]);

  useEffect(() => {
    if (!active) {
      setTargetRect(null);
      return;
    }

    if (currentStep?.settingsTab) {
      const timeout = window.setTimeout(
        () => clickSettingsTab(currentStep.settingsTab as string),
        180,
      );
      return () => window.clearTimeout(timeout);
    }
  }, [active, currentStep]);

  useEffect(() => {
    if (!active || !currentStep) return;

    let attempts = 0;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      attempts += 1;

      if (!currentStep.target) {
        setTargetRect(null);
        return;
      }

      const element = document.querySelector(currentStep.target);
      if (!element) {
        setTargetRect(null);
        return;
      }

      if (attempts === 1) {
        element.scrollIntoView({
          block: "center",
          inline: "center",
          behavior: "smooth",
        });
      }

      window.setTimeout(() => {
        if (!cancelled) {
          setTargetRect(getHighlightRect(element));
        }
      }, 120);
    };

    measure();
    const intervalId = window.setInterval(measure, 180);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, currentStep, pathname]);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void handleSkip();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        void handleNext();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleBack = () => {
    setStepIndex((index) => Math.max(0, index - 1));
  };

  const handleNext = async () => {
    if (!isLastStep) {
      setStepIndex((index) => Math.min(steps.length - 1, index + 1));
      return;
    }

    setSaving(true);
    try {
      await completeTutorial();
      setActive(false);
      startMarkedRef.current = false;
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await skipTutorial();
      setActive(false);
      startMarkedRef.current = false;
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || !active || !currentStep) {
    return null;
  }

  const tutorial = (
    <AnimatePresence>
      <motion.div
        key="tutorial"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9998] pointer-events-auto"
        aria-live="polite"
      >
        {targetRect ? (
          <motion.div
            layout
            className="fixed rounded-2xl border-2 border-primary bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_0_0_4px_rgba(255,255,255,0.35),0_18px_60px_rgba(0,0,0,0.35)] pointer-events-none"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
            }}
          />
        ) : (
          <div className="fixed inset-0 bg-black/55" />
        )}

        <motion.section
          key={currentStep.id}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-label={currentStep.title}
          className={[
            "fixed z-[10000] w-[min(420px,calc(100vw-32px))] rounded-2xl border border-base-300 bg-base-100 text-base-content shadow-2xl overflow-hidden",
            targetRect ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          ].join(" ")}
          style={targetRect ? getCardPosition(targetRect) : undefined}
        >
          <div className="h-1.5 bg-base-300">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
                Step {stepIndex + 1} of {steps.length}
              </p>
              <button
                type="button"
                onClick={handleSkip}
                disabled={saving}
                className="btn btn-ghost btn-xs rounded-lg text-base-content/50 hover:text-error"
              >
                Cancel
              </button>
            </div>

            <h2 className="mt-3 text-xl font-bold tracking-tight">
              {currentStep.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-base-content/65">
              {currentStep.body}
            </p>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={stepIndex === 0 || saving}
                className="btn btn-ghost btn-sm rounded-lg"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={saving}
                className="btn btn-primary btn-sm rounded-lg min-w-24"
              >
                {saving ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : isLastStep ? (
                  "Finish"
                ) : (
                  "Next"
                )}
              </button>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(tutorial, document.body);
};

export default AppTutorial;
