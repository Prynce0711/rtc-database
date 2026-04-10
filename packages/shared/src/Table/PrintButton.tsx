"use client";

import { useMemo, useState } from "react";
import { FiPrinter } from "react-icons/fi";

type PaperSize = "legal" | "letter" | "a4";
type Orientation = "portrait" | "landscape";

type PrintButtonProps = {
  targetId?: string;
  className?: string;
  label?: string;
  defaultPaperSize?: PaperSize;
  orientation?: Orientation;
  showPaperSizeSelector?: boolean;
  disabled?: boolean;
  onBeforePrint?: () => void | Promise<void>;
  onAfterPrint?: () => void;
};

const PAPER_LABELS: Record<PaperSize, string> = {
  legal: "Legal",
  letter: "Letter",
  a4: "A4",
};

function getPrintableMarkup(targetId?: string): string {
  if (!targetId) return document.body.innerHTML;

  const target = document.getElementById(targetId);
  return target?.outerHTML ?? document.body.innerHTML;
}

function getDocumentStyles(): string {
  const styleTags = Array.from(document.querySelectorAll("style"))
    .map((styleTag) => styleTag.outerHTML)
    .join("\n");

  const stylesheetLinks = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]'),
  )
    .map((linkTag) => linkTag.outerHTML)
    .join("\n");

  return `${stylesheetLinks}\n${styleTags}`;
}

const PrintButton = ({
  targetId,
  className,
  label = "Print",
  defaultPaperSize = "legal",
  orientation = "portrait",
  showPaperSizeSelector = false,
  disabled = false,
  onBeforePrint,
  onAfterPrint,
}: PrintButtonProps) => {
  const [paperSize, setPaperSize] = useState<PaperSize>(defaultPaperSize);
  const [isPrinting, setIsPrinting] = useState(false);

  const buttonClassName = useMemo(
    () =>
      className ??
      "btn btn-sm btn-primary gap-2 normal-case text-white hover:text-white",
    [className],
  );

  const handlePrint = async () => {
    if (typeof window === "undefined" || isPrinting || disabled) return;

    setIsPrinting(true);

    try {
      await onBeforePrint?.();

      const printWindow = window.open(
        "",
        "_blank",
        "noopener,noreferrer,width=1200,height=800",
      );

      if (!printWindow) {
        throw new Error("Print window was blocked by the browser.");
      }

      const printableMarkup = getPrintableMarkup(targetId);
      const inheritedStyles = getDocumentStyles();

      printWindow.document.open();
      printWindow.document.write(`
<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<title>${label}</title>
		${inheritedStyles}
		<style>
			@page {
				size: ${paperSize} ${orientation};
				margin: 0.5in;
			}

			html,
			body {
				width: 100%;
				margin: 0;
				padding: 0;
			}

			body {
				-webkit-print-color-adjust: exact !important;
				print-color-adjust: exact !important;
			}
		</style>
	</head>
	<body>
		${printableMarkup}
	</body>
</html>
`);
      printWindow.document.close();
      printWindow.focus();

      const finalize = () => {
        onAfterPrint?.();
        setIsPrinting(false);
      };

      printWindow.onafterprint = () => {
        printWindow.close();
        finalize();
      };

      window.setTimeout(() => {
        printWindow.print();
      }, 200);
    } catch (error) {
      console.error("Unable to print.", error);
      setIsPrinting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {showPaperSizeSelector && (
        <label className="form-control">
          <span className="sr-only">Paper size</span>
          <select
            className="select select-sm select-bordered"
            value={paperSize}
            onChange={(event) => setPaperSize(event.target.value as PaperSize)}
            disabled={disabled || isPrinting}
            aria-label="Paper size"
          >
            {Object.entries(PAPER_LABELS).map(([value, optionLabel]) => (
              <option key={value} value={value}>
                {optionLabel}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        className={buttonClassName}
        onClick={handlePrint}
        disabled={disabled || isPrinting}
        aria-label={label}
      >
        <FiPrinter size={16} />
        <span>{isPrinting ? "Preparing..." : label}</span>
      </button>
    </div>
  );
};

export default PrintButton;
