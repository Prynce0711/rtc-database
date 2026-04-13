import { criminalCaseAdapter } from "@/app/components/Case/Criminal/CriminalCaseAdapter";
import { auth } from "@/app/lib/auth";
import { CriminalCasePage, Roles } from "@rtc-database/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user || !session.user.role) {
    redirect("/");
  }

  return (
    <CriminalCasePage
      role={session.user.role as Roles}
      adapter={criminalCaseAdapter}
    />
  );
}
