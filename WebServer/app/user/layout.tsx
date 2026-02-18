import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";
import { hasPassword } from "../components/AccountManagement/AccountActions";
import Sidebar from "../components/Sidebar/Sidebar";
import { auth } from "../lib/auth";

const layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session || !session.user) {
    redirect("/");
  }

  const hasPasswordResult = await hasPassword();

  if (!hasPasswordResult.success) {
    redirect("/firstlogin");
  }

  return <Sidebar>{children}</Sidebar>;
};

export default layout;
