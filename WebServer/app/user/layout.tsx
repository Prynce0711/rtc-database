import { Sidebar } from "@rtc-database/shared";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";
import { hasPassword } from "../components/AccountManagement/AccountActions";
import { updateDarkMode } from "../components/Sidebar/DarkModeActions";
import { auth } from "../lib/auth";
import { signOut } from "../lib/authActions";

const layout = async ({ children }: { children: React.ReactNode }) => {
  // if they switch to accounts page while having the two factor cookie, we want to remove it for security purposes
  const cookieStore = await cookies();
  const hasTwoFactorCookie = Boolean(
    cookieStore.get("better-auth.two_factor")?.value ||
    cookieStore.get("__Secure-better-auth.two_factor")?.value,
  );

  if (hasTwoFactorCookie) {
    cookieStore.delete("better-auth.two_factor");
    cookieStore.delete("__Secure-better-auth.two_factor");
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session || !session.user || session.user.banned) {
    redirect("/");
  }

  const hasPasswordResult = await hasPassword();

  if (!hasPasswordResult.success) {
    redirect("/firstlogin");
  }

  return (
    // <SyncProvider>
    <Sidebar
      session={session}
      updateDarkMode={updateDarkMode}
      onSignOut={signOut}
    >
      {children}
    </Sidebar>
    // </SyncProvider>
  );
};

export default layout;
