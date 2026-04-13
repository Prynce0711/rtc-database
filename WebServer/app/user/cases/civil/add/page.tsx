"use client";

import { civilCaseAdapter } from "@/app/components/Case/Civil/CivilCaseAdapter";
import { CivilCaseUpdatePage } from "@rtc-database/shared";
import { useRouter } from "next/navigation";

const CivilAddPage = () => {
  const router = useRouter();

  const goBackToList = () => {
    router.push("/user/cases/civil");
  };

  return (
    <CivilCaseUpdatePage
      adapter={civilCaseAdapter}
      onClose={goBackToList}
      onCreate={goBackToList}
      onUpdate={goBackToList}
    />
  );
};

export default CivilAddPage;
