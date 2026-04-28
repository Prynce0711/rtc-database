import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import Roles from "./Roles";

export async function requireUserRole(
  allowedRoles: readonly Roles[],
): Promise<Roles> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || session.user.banned) {
    redirect("/");
  }

  const role = session.user.role as Roles | undefined;

  if (!role || !allowedRoles.includes(role)) {
    redirect("/user/dashboard");
  }

  return role;
}
