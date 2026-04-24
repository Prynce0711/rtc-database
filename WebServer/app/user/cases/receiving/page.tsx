"use client";

import recievingLogsAdapter from "@/app/components/Case/ReceivingLogs/RecievingLogsAdapter";
import { useSession } from "@/app/lib/authClient";
import { ReceivingLogsPage, RedirectingUI, Roles } from "@rtc-database/shared";
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
    <ReceivingLogsPage
      adapter={recievingLogsAdapter}
      role={session.data?.user?.role as Roles}
    />
  );
}
