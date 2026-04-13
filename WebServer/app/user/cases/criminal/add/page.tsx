"use client";

import criminalCaseAdapter from "@/app/components/Case/Criminal/CriminalCaseAdapter";
import { CriminalCaseUpdatePage } from "@rtc-database/shared";
import { useRouter } from "next/navigation";

const CriminalAddPage = () => {
  const router = useRouter();

  const goBackToList = () => {
    router.push("/user/cases/criminal");
  };

  return (
    <CriminalCaseUpdatePage
      onClose={goBackToList}
      onCreate={goBackToList}
      onUpdate={goBackToList}
      adapter={criminalCaseAdapter}
    />
  );
};

export default CriminalAddPage;
