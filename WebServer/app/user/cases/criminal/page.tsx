"use client";

import { criminalCaseAdapter } from "@/app/components/Case/Criminal/CriminalCaseAdapter";
import { useSession } from "@/app/lib/authClient";
import { CriminalCasePage, RedirectingUI, Roles } from "@rtc-database/shared";
import { redirect } from "next/navigation";

export default function Page() {
  const session = useSession();

  if (session.isPending) {
    return <RedirectingUI titleText="Loading case records..." />;
  }

  if (!session.data?.user?.role) {
    redirect("/");
  }

  return (
    <CriminalCasePage
      role={session.data?.user?.role as Roles}
      adapter={criminalCaseAdapter}
    />
  );
}
