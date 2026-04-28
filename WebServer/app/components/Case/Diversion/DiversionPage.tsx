"use client";

import { useSession } from "@/app/lib/authClient";
import {
  CivilCaseRow,
  CriminalCaseRow,
  type CivilCaseData,
  type CriminalCaseData,
  type RecievingLog,
  RedirectingUI,
  ReceivingRow,
  Roles,
  type SheriffCaseData,
  SherriffCaseRow,
  SpecialProceedingRow,
  type SpecialProceedingData,
  Table,
} from "@rtc-database/shared";
import {
  redirect,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import {
  FiArrowRight,
  FiClock,
  FiFileText,
  FiFolder,
  FiInbox,
  FiLayers,
} from "react-icons/fi";
import {
  getDiversionDashboardData,
  type DiversionDashboardData,
  type DiversionView,
} from "./DiversionActions";

type ViewConfig = {
  key: DiversionView;
  label: string;
  description: string;
};

const VIEW_CONFIG: ViewConfig[] = [
  {
    key: "criminal",
    label: "Criminal",
    description: "Criminal case diversion records",
  },
  {
    key: "civil",
    label: "Civil",
    description: "Civil case diversion records",
  },
  {
    key: "receiving",
    label: "Receiving Logs",
    description: "Receiving log diversion records",
  },
  {
    key: "sheriff",
    label: "Sheriff",
    description: "Sheriff case diversion records",
  },
  {
    key: "proceedings",
    label: "Special Proceedings",
    description: "Special proceedings diversion records",
  },
];

const EMPTY_DATA: DiversionDashboardData = {
  criminal: [],
  civil: [],
  receiving: [],
  sheriff: [],
  proceedings: [],
};

const isDiversionView = (value: string | null): value is DiversionView =>
  VIEW_CONFIG.some((view) => view.key === value);

const SummaryCard = ({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "accent";
}) => (
  <div
    className={[
      "rounded-2xl border p-4 shadow-sm",
      tone === "accent"
        ? "border-primary/30 bg-primary/10"
        : "border-base-200 bg-base-100",
    ].join(" ")}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/40">
          {label}
        </p>
        <p className="mt-2 text-2xl font-black tracking-tight text-base-content">
          {value}
        </p>
      </div>
      <div
        className={[
          "rounded-xl p-3",
          tone === "accent" ? "bg-primary/10 text-primary" : "bg-base-200",
        ].join(" ")}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const CriminalDiversionTable = ({
  records,
  role,
}: {
  records: CriminalCaseData[];
  role: Roles;
}) => (
  <Table
    headers={[
      { key: "caseNumber", label: "Case Number" },
      { key: "branch", label: "Branch" },
      { key: "assistantBranch", label: "Assistant Branch" },
      { key: "dateFiled", label: "Date Filed" },
      { key: "name", label: "Name" },
      { key: "charge", label: "Charge" },
      { key: "infoSheet", label: "Info Sheet" },
      { key: "court", label: "Court" },
      { key: "detained", label: "Detained" },
      { key: "consolidation", label: "Consolidation" },
      { key: "eqcNumber", label: "EQC Number" },
      { key: "bond", label: "Bond" },
      { key: "raffleDate", label: "Raffle Date" },
      { key: "committee1", label: "Committee 1" },
      { key: "committee2", label: "Committee 2" },
      { key: "judge", label: "Judge" },
      { key: "ao", label: "AO" },
      { key: "complainant", label: "Complainant" },
      { key: "houseNo", label: "House No." },
      { key: "street", label: "Street" },
      { key: "barangay", label: "Barangay" },
      { key: "municipality", label: "Municipality" },
      { key: "province", label: "Province" },
      { key: "counts", label: "Counts" },
      { key: "jdf", label: "JDF" },
      { key: "sajj", label: "SAJJ" },
      { key: "sajj2", label: "SAJJ2" },
      { key: "mf", label: "MF" },
      { key: "stf", label: "STF" },
      { key: "lrf", label: "LRF" },
      { key: "vcf", label: "VCF" },
      { key: "total", label: "Total" },
      { key: "amountInvolved", label: "Amount Involved" },
    ]}
    data={records}
    rowsPerPage={10}
    resizableColumns
    disableCellTooltips={false}
    minColumnWidth={96}
    renderRow={(record) => (
      <CriminalCaseRow
        key={record.id}
        caseItem={record}
        handleDeleteCase={() => undefined}
        onEdit={() => undefined}
        role={role}
      />
    )}
  />
);

const CivilDiversionTable = ({ records }: { records: CivilCaseData[] }) => {
  const router = useRouter();

  return (
    <Table
      headers={[
        { key: "caseNumber", label: "Case Number" },
        { key: "branch", label: "Branch" },
        { key: "petitioners", label: "Petitioner/s" },
        { key: "defendants", label: "Defendant/s" },
        { key: "dateFiled", label: "Date Filed" },
        { key: "notes", label: "Notes/Appealed" },
        { key: "nature", label: "Nature" },
      ]}
      data={records}
      rowsPerPage={10}
      resizableColumns
      disableCellTooltips={false}
      minColumnWidth={110}
      renderRow={(record) => (
        <CivilCaseRow
          key={record.id}
          caseItem={record}
          onView={(item) => router.push(`/user/cases/civil/${item.id}`)}
        />
      )}
    />
  );
};

const ReceivingDiversionTable = ({
  records,
}: {
  records: RecievingLog[];
}) => {
  const router = useRouter();

  return (
    <Table
      headers={[
        { key: "bookAndPage", label: "Book And Pages" },
        { key: "dateRecieved", label: "Date Received" },
        { key: "caseType", label: "Case Type" },
        { key: "caseNumber", label: "Case Number" },
        { key: "content", label: "Content" },
        { key: "branchNumber", label: "Branch No" },
        { key: "time", label: "Time" },
        { key: "notes", label: "Notes" },
      ]}
      data={records as unknown as Record<string, unknown>[]}
      rowsPerPage={10}
      resizableColumns
      disableCellTooltips={false}
      minColumnWidth={96}
      renderRow={(record) => (
        <ReceivingRow
          key={(record as unknown as RecievingLog).id}
          log={record as unknown as RecievingLog}
          onView={(item) => router.push(`/user/cases/receiving/${item.id}`)}
          canManageLogs={false}
        />
      )}
    />
  );
};

const SheriffDiversionTable = ({
  records,
}: {
  records: SheriffCaseData[];
}) => {
  const router = useRouter();

  return (
    <Table
      headers={[
        { key: "caseNumber", label: "Case Number" },
        { key: "sheriffName", label: "Sheriff Name" },
        { key: "mortgagee", label: "Mortgagee" },
        { key: "mortgagor", label: "Mortgagor" },
        { key: "dateFiled", label: "Date Filed" },
        { key: "remarks", label: "Remarks" },
      ]}
      data={records}
      rowsPerPage={10}
      resizableColumns
      disableCellTooltips={false}
      minColumnWidth={110}
      renderRow={(record) => (
        <SherriffCaseRow
          key={record.id}
          record={record}
          onRowClick={(item) => router.push(`/user/cases/sheriff/${item.id}`)}
        />
      )}
    />
  );
};

const ProceedingsDiversionTable = ({
  records,
}: {
  records: SpecialProceedingData[];
}) => {
  const router = useRouter();

  return (
    <Table
      headers={[
        { key: "caseNumber", label: "SPC. NO." },
        { key: "raffledTo", label: "Branch" },
        { key: "date", label: "Date Filed" },
        { key: "petitioner", label: "Petitioner/s" },
        { key: "nature", label: "Nature" },
        { key: "respondent", label: "Respondent" },
      ]}
      data={records}
      rowsPerPage={10}
      resizableColumns
      disableCellTooltips={false}
      minColumnWidth={110}
      renderRow={(record) => (
        <SpecialProceedingRow
          key={record.id}
          caseItem={record}
          onRowClick={(item) =>
            router.push(`/user/cases/proceedings/${item.id}`)
          }
        />
      )}
    />
  );
};

export default function DiversionPage() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<DiversionDashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeView = useMemo<DiversionView>(() => {
    const section = searchParams.get("section");
    return isDiversionView(section) ? section : "criminal";
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      const result = await getDiversionDashboardData();

      if (cancelled) {
        return;
      }

      if (!result.success) {
        setError(result.error || "Failed to load diversion records");
        setData(EMPTY_DATA);
        setLoading(false);
        return;
      }

      if (!result.result) {
        setError("Failed to load diversion records");
        setData(EMPTY_DATA);
        setLoading(false);
        return;
      }

      setData(result.result);
      setError(null);
      setLoading(false);
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  if (session.isPending || loading) {
    return <RedirectingUI titleText="Loading diversion records..." />;
  }

  if (!session.data?.user?.role) {
    redirect("/");
  }

  const role = session.data.user.role as Roles;
  const counts = {
    criminal: data.criminal.length,
    civil: data.civil.length,
    receiving: data.receiving.length,
    sheriff: data.sheriff.length,
    proceedings: data.proceedings.length,
  };
  const totalRecords = Object.values(counts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const populatedSections = Object.values(counts).filter(
    (value) => value > 0,
  ).length;
  const currentView = VIEW_CONFIG.find((view) => view.key === activeView)!;

  const updateSection = (view: DiversionView) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", view);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const renderActiveTable = () => {
    switch (activeView) {
      case "criminal":
        return <CriminalDiversionTable records={data.criminal} role={role} />;
      case "civil":
        return <CivilDiversionTable records={data.civil} />;
      case "receiving":
        return <ReceivingDiversionTable records={data.receiving} />;
      case "sheriff":
        return <SheriffDiversionTable records={data.sheriff} />;
      case "proceedings":
        return <ProceedingsDiversionTable records={data.proceedings} />;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-base font-bold text-base-content mb-1">
                <span>Cases</span>
                <span className="text-base-content/30">/</span>
                <span className="text-base-content/70 font-medium">
                  Diversion
                </span>
                <span className="text-base-content/30">/</span>
                <span className="text-base-content/70 font-medium">
                  {currentView.label}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Diversion Cases
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/55">
                <FiArrowRight className="shrink-0" />
                <span>{currentView.description}</span>
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-base-200 bg-base-100 px-4 py-3 text-sm text-base-content/60">
              <FiClock className="h-4 w-4 shrink-0" />
              <span>
                Records are shown from the dedicated diversion tables.
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          icon={FiLayers}
          label="Total Records"
          value={totalRecords.toLocaleString()}
          tone="accent"
        />
        <SummaryCard
          icon={FiFolder}
          label="Populated Sections"
          value={`${populatedSections}/5`}
        />
        <SummaryCard
          icon={FiInbox}
          label={`${currentView.label} Records`}
          value={counts[activeView].toLocaleString()}
        />
      </div>

      <section className="rounded-3xl border border-base-200 bg-base-100 p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {VIEW_CONFIG.map((view) => {
            const isActive = activeView === view.key;
            return (
              <button
                key={view.key}
                type="button"
                onClick={() => updateSection(view.key)}
                className={[
                  "min-w-[13rem] rounded-2xl border px-4 py-3 text-left transition-all",
                  isActive
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-base-200 bg-base-100 text-base-content/65 hover:border-base-300 hover:bg-base-200/40",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{view.label}</div>
                    <div className="mt-1 text-xs leading-5 opacity-75">
                      {view.description}
                    </div>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-black",
                      isActive
                        ? "bg-primary text-primary-content"
                        : "bg-base-200 text-base-content/60",
                    ].join(" ")}
                  >
                    {counts[view.key]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-base-200 bg-base-100 shadow-lg">
        <div className="border-b border-base-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <FiFileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-base-content">
                {currentView.label} Table
              </h2>
              <p className="text-sm text-base-content/55">
                Same column layout as the source{" "}
                {currentView.label.toLowerCase()} records.
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {error ? (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          ) : (
            renderActiveTable()
          )}
        </div>
      </section>
    </div>
  );
}
