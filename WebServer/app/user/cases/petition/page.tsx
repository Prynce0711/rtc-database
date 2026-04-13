import { petitionCaseAdapter } from "@/app/components/Case/Petition/PetitionCaseAdapter";
import { auth } from "@/app/lib/auth";
import { PetitionCasePage, Roles } from "@rtc-database/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user || !session.user.role) {
    redirect("/");
  }

  return (
    <PetitionCasePage
      role={session.user.role as Roles}
      adapter={petitionCaseAdapter}
    />
  );
}
