"use client";

import civilCaseAdapter from "@/app/components/Case/Civil/CivilCaseAdapter";
import { useSession } from "@/app/lib/authClient";
import { CivilCasePage, RedirectingUI, Roles } from "@rtc-database/shared";
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
    <CivilCasePage
      role={session.data?.user?.role as Roles}
      adapter={civilCaseAdapter}
    />
  );
}
