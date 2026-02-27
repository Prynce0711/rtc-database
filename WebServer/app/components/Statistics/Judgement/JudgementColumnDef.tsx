import { AnyColumnDef } from "../Annual/AnnualColumnDef";
import { JudgementLog } from "./JudgementRecord";

const asJudgement = (r: Record<string, unknown>) =>
  r as unknown as JudgementLog;

export const judgementColumns: AnyColumnDef[] = [
  {
    key: "branchNo",
    label: "Branch",
    sortable: true,
    align: "center",
    render: (r) => asJudgement(r).branchNo ?? "—",
  },
  {
    title: "Number of Cases Heard/Tried",
    align: "center",
    children: [
      {
        key: "civilV",
        label: "CIVIL V",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).civilV ?? "",
      },
      {
        key: "civilInC",
        label: "In-C",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).civilInC ?? "",
      },
      {
        key: "criminalV",
        label: "CRIMINAL V",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).criminalV ?? "",
      },
      {
        key: "criminalInC",
        label: "In-C",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).criminalInC ?? "",
      },
      {
        key: "totalHeard",
        label: "TOTAL HEARD",
        sortable: true,
        align: "center",
        render: (r) => asJudgement(r).totalHeard ?? "—",
      },
    ],
  },
  {
    title: "Number of Cases Disposed",
    align: "center",
    children: [
      {
        key: "disposedCivil",
        label: "Civil",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).disposedCivil ?? "",
      },
      {
        key: "disposedCrim",
        label: "Crim",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).disposedCrim ?? "",
      },
      {
        key: "summaryProc",
        label: "Summary Proc",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).summaryProc ?? "",
      },
      {
        key: "totalDisposed",
        label: "Total",
        sortable: true,
        align: "center",
        render: (r) => asJudgement(r).totalDisposed ?? "—",
      },
    ],
  },
  {
    title: "PDL / CICL",
    align: "center",
    children: [
      {
        key: "PDL_M",
        label: "M",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).PDL_M ?? "",
      },
      {
        key: "PDL_F",
        label: "F",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).PDL_F ?? "",
      },
      {
        key: "PDL_CICL",
        label: "CICL",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).PDL_CICL ?? "",
      },
      {
        key: "PDL_Total",
        label: "Total",
        sortable: false,
        align: "center",
        render: (r) => asJudgement(r).PDL_Total ?? "",
      },
    ],
  },
  {
    key: "fine",
    label: "Fine",
    sortable: false,
    align: "center",
    render: (r) => asJudgement(r).fine ?? "",
  },
];

export default judgementColumns;
