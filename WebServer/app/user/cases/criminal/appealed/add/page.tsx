"use client";

import CriminalAppealedFormPage from "@/app/components/Case/Criminal/CriminalAppealedFormPage";
import { useSession } from "@/app/lib/authClient";
import { RedirectingUI, Roles } from "@rtc-database/shared";
import { redirect } from "next/navigation";

export default function Page() {
  const session = useSession();

  if (session.isPending) {
    return <RedirectingUI titleText="Loading appealed case form..." />;
  }

  if (!session.data?.user?.role) {
    redirect("/");
  }

  return <CriminalAppealedFormPage role={session.data.user.role as Roles} />;
}
