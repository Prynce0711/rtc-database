import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

async function main() {
  // Create admin user
  try {
    const adminResult = await auth.api.signUpEmail({
      body: {
        email: "admin@admin.com",
        password: "admin123",
        name: "Admin",
      },
    });

    if (adminResult) {
      console.log("Created admin user successfully");
    }
  } catch (error: any) {
    console.error(`Failed to create admin user: ${error.message}`);
  }

  // Create staff user
  try {
    const staffResult = await auth.api.signUpEmail({
      body: {
        email: "staff@staff.com",
        password: "staff123",
        name: "Staff",
      },
    });

    if (staffResult) {
      console.log("Created staff user successfully");
    }
  } catch (error: any) {
    console.error(`Failed to create staff user: ${error.message}`);
  }

  await prisma.user.update({
    where: { email: "admin@admin.com" },
    data: { role: "admin" },
  });

  const cases = [
    {
      branch: "North Branch",
      assistantBranch: "NA-1",
      caseNumber: "2024-001",
      dateFiled: new Date("2024-01-15"),
      name: "John Smith v. State",
      charge: "DUI",
      infoSheet: "DUI-001",
      court: "District Court A",
      detained: true,
      consolidation: "CONS-001",
      eqcNumber: 10001,
      bond: 5000.0,
      raffleDate: new Date("2024-02-01"),
      committe1: 1,
      committe2: 2,
    },
    {
      branch: "South Branch",
      assistantBranch: "SA-2",
      caseNumber: "2024-002",
      dateFiled: new Date("2024-01-20"),
      name: "Maria Garcia v. State",
      charge: "Drug Possession",
      infoSheet: "DRUG-001",
      court: "District Court B",
      detained: false,
      consolidation: "CONS-002",
      eqcNumber: 10002,
      bond: 2500.0,
      raffleDate: new Date("2024-02-05"),
      committe1: 2,
      committe2: 3,
    },
    {
      branch: "East Branch",
      assistantBranch: "EA-3",
      caseNumber: "2024-003",
      dateFiled: new Date("2024-02-01"),
      name: "Robert Johnson v. State",
      charge: "Assault",
      infoSheet: "ASSAULT-001",
      court: "District Court C",
      detained: true,
      consolidation: "CONS-003",
      eqcNumber: 10003,
      bond: 7500.0,
      raffleDate: new Date("2024-02-15"),
      committe1: 3,
      committe2: 1,
    },
    {
      branch: "West Branch",
      assistantBranch: "WA-4",
      caseNumber: "2024-004",
      dateFiled: new Date("2024-02-05"),
      name: "Sarah Williams v. State",
      charge: "Theft",
      infoSheet: "THEFT-001",
      court: "District Court A",
      detained: false,
      consolidation: "CONS-004",
      eqcNumber: 10004,
      bond: 3000.0,
      raffleDate: new Date("2024-02-20"),
      committe1: 1,
      committe2: 3,
    },
    {
      branch: "North Branch",
      assistantBranch: "NA-1",
      caseNumber: "2024-005",
      dateFiled: new Date("2024-02-08"),
      name: "Michael Brown v. State",
      charge: "Burglary",
      infoSheet: "BURG-001",
      court: "District Court B",
      detained: true,
      consolidation: "CONS-005",
      eqcNumber: 10005,
      bond: 10000.0,
      raffleDate: new Date("2024-02-25"),
      committe1: 2,
      committe2: 1,
    },
    {
      branch: "South Branch",
      assistantBranch: "SA-2",
      caseNumber: "2024-006",
      dateFiled: new Date("2024-02-10"),
      name: "Jennifer Davis v. State",
      charge: "Fraud",
      infoSheet: "FRAUD-001",
      court: "District Court C",
      detained: false,
      consolidation: "CONS-006",
      eqcNumber: 10006,
      bond: 4500.0,
      raffleDate: new Date("2024-03-01"),
      committe1: 3,
      committe2: 2,
    },
    {
      branch: "East Branch",
      assistantBranch: "EA-3",
      caseNumber: "2024-007",
      dateFiled: new Date("2024-02-12"),
      name: "David Wilson v. State",
      charge: "Robbery",
      infoSheet: "ROB-001",
      court: "District Court A",
      detained: true,
      consolidation: "CONS-007",
      eqcNumber: 10007,
      bond: 15000.0,
      raffleDate: new Date("2024-03-05"),
      committe1: 1,
      committe2: 2,
    },
    {
      branch: "West Branch",
      assistantBranch: "WA-4",
      caseNumber: "2024-008",
      dateFiled: new Date("2024-02-14"),
      name: "Emily Martinez v. State",
      charge: "Traffic Violation",
      infoSheet: "TRAFFIC-001",
      court: "District Court B",
      detained: false,
      consolidation: "CONS-008",
      bond: 1500.0,
      raffleDate: new Date("2024-03-10"),
      committe1: 2,
      committe2: 3,
    },
    {
      branch: "North Branch",
      assistantBranch: "NA-1",
      caseNumber: "2024-009",
      dateFiled: new Date("2024-02-16"),
      name: "Christopher Lee v. State",
      charge: "Shoplifting",
      infoSheet: "SHOP-001",
      court: "District Court C",
      detained: false,
      consolidation: "CONS-009",
      eqcNumber: 10009,
      bond: 2000.0,
      raffleDate: new Date("2024-03-12"),
      committe1: 3,
      committe2: 1,
    },
    {
      branch: "South Branch",
      assistantBranch: "SA-2",
      caseNumber: "2024-010",
      dateFiled: new Date("2024-02-18"),
      name: "Amanda Taylor v. State",
      charge: "Trespassing",
      infoSheet: "TRESP-001",
      court: "District Court A",
      detained: true,
      consolidation: "CONS-010",
      eqcNumber: 10010,
      bond: 1000.0,
      raffleDate: new Date("2024-03-15"),
      committe1: 1,
      committe2: 3,
    },
  ];

  await prisma.case.createMany({
    data: cases,
  });

  console.log("Seeding completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
