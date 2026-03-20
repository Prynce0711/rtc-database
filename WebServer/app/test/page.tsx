"use client";

import { useMemo, useState } from "react";
import ChatTest from "./ChatTest";
import CivilCaseTester from "./CivilCaseTester";
import CriminalCaseTester from "./CriminalCaseTester";
import EmployeeTest from "./EmployeeTest";
import ExcelWithFileUpload from "./ExcelWithFileUpload";
import JudgementTester from "./JudgementTester";
import NotarialTester from "./NotarialTester";
import PetitionTester from "./PetitionTester";
import SpecialProceedingTester from "./SpecialProceedingTester";
import StatisticsTester from "./StatisticsTester";
import ToastTester from "./ToastTester";

type TesterItem = {
  id: string;
  label: string;
  description: string;
  Component: React.ComponentType;
};

const TESTERS: TesterItem[] = [
  {
    id: "toast",
    label: "Toast Tester",
    description: "Quickly verify toast notifications.",
    Component: ToastTester,
  },
  {
    id: "chat",
    label: "Chat Test",
    description: "Test chat features and message behavior.",
    Component: ChatTest,
  },
  {
    id: "civil",
    label: "Civil Case Tester",
    description: "Validate civil case actions and data flow.",
    Component: CivilCaseTester,
  },
  {
    id: "criminal",
    label: "Criminal Case Tester",
    description: "Validate criminal case actions and workflows.",
    Component: CriminalCaseTester,
  },
  {
    id: "employee",
    label: "Employee Test",
    description: "Test employee CRUD and related actions.",
    Component: EmployeeTest,
  },
  {
    id: "excel-upload",
    label: "Excel Upload Test",
    description: "Test excel upload and parsing behavior.",
    Component: ExcelWithFileUpload,
  },
  {
    id: "judgement",
    label: "Judgement Tester",
    description: "Test judgement data and operations.",
    Component: JudgementTester,
  },
  {
    id: "notarial",
    label: "Notarial Tester",
    description: "Test notarial create, update, delete, and file handling.",
    Component: NotarialTester,
  },
  {
    id: "petition",
    label: "Petition Tester",
    description: "Validate petition-related operations.",
    Component: PetitionTester,
  },
  {
    id: "special-proceeding",
    label: "Special Proceeding Tester",
    description: "Test special proceeding operations.",
    Component: SpecialProceedingTester,
  },
  {
    id: "statistics",
    label: "Statistics Tester",
    description: "Validate statistics calculations and UI output.",
    Component: StatisticsTester,
  },
];

export default function TestPage() {
  const [selectedTesterId, setSelectedTesterId] = useState<string>(
    TESTERS[0]?.id ?? "",
  );

  const selectedTester = useMemo(
    () =>
      TESTERS.find((tester) => tester.id === selectedTesterId) ?? TESTERS[0],
    [selectedTesterId],
  );

  if (!selectedTester) {
    return (
      <div className="min-h-screen p-6">
        <div className="alert alert-warning">
          <span>No tester components available.</span>
        </div>
      </div>
    );
  }

  const SelectedComponent = selectedTester.Component;

  return (
    <div className="min-h-screen bg-base-200 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">Test Hub</h1>
              <p className="mt-1 text-sm text-base-content/70">
                Select which tester UI you want to run.
              </p>
            </div>

            <div className="w-full lg:w-96">
              <label className="mb-2 block text-sm font-medium">
                Active Tester
              </label>
              <select
                className="select select-bordered w-full"
                value={selectedTesterId}
                onChange={(e) => setSelectedTesterId(e.target.value)}
              >
                {TESTERS.map((tester) => (
                  <option key={tester.id} value={tester.id}>
                    {tester.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {TESTERS.map((tester) => {
              const isActive = tester.id === selectedTesterId;

              return (
                <button
                  key={tester.id}
                  type="button"
                  className={`rounded-lg border p-3 text-left transition ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-base-300 bg-base-100 hover:border-primary/40"
                  }`}
                  onClick={() => setSelectedTesterId(tester.id)}
                >
                  <div className="font-semibold">{tester.label}</div>
                  <div className="mt-1 text-xs text-base-content/70">
                    {tester.description}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-base-300 bg-base-100 shadow-sm">
          <div className="border-b border-base-300 px-4 py-3 md:px-6">
            <h2 className="text-lg font-semibold">{selectedTester.label}</h2>
            <p className="text-sm text-base-content/70">
              {selectedTester.description}
            </p>
          </div>
          <div className="p-0 md:p-2">
            <SelectedComponent />
          </div>
        </section>
      </div>
    </div>
  );
}
