"use client";

import { petitionCaseAdapter } from "@/app/components/Case/Petition/PetitionCaseAdapter";
import { useSession } from "@/app/lib/authClient";
import { PetitionCasePage, RedirectingUI, Roles } from "@rtc-database/shared";
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
    <PetitionCasePage
      role={session.data?.user?.role as Roles}
      adapter={petitionCaseAdapter}
    />
  );
}
