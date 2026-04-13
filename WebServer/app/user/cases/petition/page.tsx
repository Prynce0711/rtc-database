"use client";

import { petitionCaseAdapter } from "@/app/components/Case/Petition/PetitionCaseAdapter";
import { useSession } from "@/app/lib/authClient";
import { PetitionCasePage, Roles } from "@rtc-database/shared";

const page = () => {
  const session = useSession();
  const role = (session?.data?.user?.role as Roles | undefined) ?? Roles.ATTY;

  return <PetitionCasePage role={role} adapter={petitionCaseAdapter} />;
};

export default page;
