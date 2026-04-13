"use client";

import { civilCaseAdapter } from "@/app/components/Case/Civil/CivilCaseAdapter";
import { useSession } from "@/app/lib/authClient";
import { CivilCasePage, Roles } from "@rtc-database/shared";

const page = () => {
  const session = useSession();
  const role = (session?.data?.user?.role as Roles | undefined) ?? Roles.ATTY;

  return <CivilCasePage role={role} adapter={civilCaseAdapter} />;
};

export default page;
