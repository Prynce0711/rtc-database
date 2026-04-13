import recievingLogsAdapter from "@/app/components/Case/ReceivingLogs/RecievingLogsAdapter";
import { auth } from "@/app/lib/auth";
import { ReceivingLogsPage, Roles } from "@rtc-database/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user || !session.user.role) {
    redirect("/");
  }

  return (
    <ReceivingLogsPage
      adapter={recievingLogsAdapter}
      role={session.user.role as Roles}
    />
  );
}
