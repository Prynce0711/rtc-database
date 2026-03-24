import { FiFileText, FiFolder } from "react-icons/fi";
import { NotarialFormEntry } from "./Notarial";

function ReviewCard({ entry }: { entry: NotarialFormEntry }) {
  const fmtDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <div className="rv-card">
      <div className="rv-hero">
        <div className="rv-hero-left">
          <div className="rv-hero-casenum">
            {entry.atty || <span style={{ opacity: 0.4 }}>No Attorney</span>}
          </div>
          <div className="rv-hero-name">
            {entry.title || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No title entered
              </span>
            )}
          </div>
          {entry.name && <div className="rv-hero-charge">{entry.name}</div>}
        </div>
        <div className="rv-hero-badges">
          {entry.date && (
            <span className="rv-badge rv-badge-court">
              {fmtDate(entry.date)}
            </span>
          )}
        </div>
      </div>

      <div className="rv-body">
        <div className="rv-body-main">
          <div className="rv-section">
            <div className="rv-section-header">
              <FiFileText size={13} />
              <span>Record Details</span>
            </div>
            <div className="rv-grid rv-grid-3">
              <div className="rv-field">
                <div className="rv-field-label">Title</div>
                <div className="rv-field-value">
                  {entry.title || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Name</div>
                <div className="rv-field-value">
                  {entry.name || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Attorney</div>
                <div className="rv-field-value">
                  {entry.atty || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Date</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.date) || <span className="rv-empty">—</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiFolder size={13} />
              <span>File Location</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field" style={{ gridColumn: "1 / -1" }}>
                <div className="rv-field-label">Link / File Path</div>
                <div
                  className="rv-field-value rv-mono"
                  style={{ fontSize: 12, wordBreak: "break-all" }}
                >
                  {entry.file ? (
                    <span>{entry.file.name}</span>
                  ) : entry.link ? (
                    <span>{entry.link}</span>
                  ) : (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewCard;
