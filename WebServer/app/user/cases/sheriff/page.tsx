"use client";

import { sherriffCaseAdapter } from "@/app/components/Case/Sherriff/SherriffCaseAdapter";
import { useSession } from "@/app/lib/authClient";
import { Roles, SherriffCasePage } from "@rtc-database/shared";
import { redirect } from "next/navigation";

export default function Page() {
  const session = useSession();
  if (!session?.data?.user?.role) {
    redirect("/");
  }

  return (
    <SherriffCasePage
      role={session.data?.user?.role as Roles}
      adapter={sherriffCaseAdapter}
    />
  );
}
