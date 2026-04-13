import { Sidebar } from "@rtc-database/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";
import { hasPassword } from "../components/AccountManagement/AccountActions";
import { updateDarkMode } from "../components/Sidebar/DarkModeActions";
import { auth } from "../lib/auth";
import { signOut } from "../lib/authActions";

const layout = async ({ children }: { children: React.ReactNode }) => {
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
    <Sidebar
      session={session}
      updateDarkMode={updateDarkMode}
      onSignOut={signOut}
    >
      {children}
    </Sidebar>
  );
};

export default layout;
