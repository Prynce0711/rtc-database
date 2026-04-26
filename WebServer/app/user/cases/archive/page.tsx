"use client";

import archiveAdapter from "@/app/components/Case/Archives/ArchiveAdapter";
import { useSession } from "@/app/lib/authClient";
import { ArchivePage, RedirectingUI, Roles } from "@rtc-database/shared";
import { redirect } from "next/navigation";

export default function Page() {
  const session = useSession();

  if (session.isPending) {
    return <RedirectingUI titleText="Loading archive explorer..." />;
  }

  if (!session.data?.user?.role) {
    redirect("/");
  }

  return (
    <ArchivePage
      adapter={archiveAdapter}
      role={session.data.user.role as Roles}
    />
  );
}
