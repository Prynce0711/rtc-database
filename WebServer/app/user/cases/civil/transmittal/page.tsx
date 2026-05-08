"use client";

import CivilTransmittalRecordPage from "@/app/components/Case/Civil/CivilTransmittalRecordPage";
import { useSession } from "@/app/lib/authClient";
import { RedirectingUI, Roles } from "@rtc-database/shared";
import { redirect } from "next/navigation";

export default function Page() {
  const session = useSession();

  if (session.isPending) {
    return <RedirectingUI titleText="Loading civil transmittal records..." />;
  }

  if (!session.data?.user?.role) {
    redirect("/");
  }

  return (
    <CivilTransmittalRecordPage
      kind="transmittal"
      role={session.data.user.role as Roles}
    />
  );
}
