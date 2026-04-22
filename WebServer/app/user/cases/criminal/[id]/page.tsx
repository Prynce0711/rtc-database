"use client";

import { criminalCaseAdapter } from "@/app/components/Case/Criminal/CriminalCaseAdapter";
import { CriminalCaseDetailsPage } from "@rtc-database/shared";

const Page = () => {
  return <CriminalCaseDetailsPage adapter={criminalCaseAdapter} />;
};

export default Page;
