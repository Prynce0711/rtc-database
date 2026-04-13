"use client";

import { criminalCaseAdapter } from "@/app/components/Case/Criminal/CriminalCaseAdapter";
import { useSession } from "@/app/lib/authClient";
import { CriminalCasePage, Roles } from "@rtc-database/shared";

export default function Page() {
  const session = useSession();
  const role = (session?.data?.user?.role as Roles | undefined) ?? Roles.ATTY;

  return <CriminalCasePage role={role} adapter={criminalCaseAdapter} />;
}