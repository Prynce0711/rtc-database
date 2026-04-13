import { civilCaseAdapter } from "@/app/components/Case/Civil/CivilCaseAdapter";
import { auth } from "@/app/lib/auth";
import { CivilCasePage, Roles } from "@rtc-database/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user || !session.user.role) {
    redirect("/");
  }

  return (
    <CivilCasePage
      role={session.user.role as Roles}
      adapter={civilCaseAdapter}
    />
  );
}
