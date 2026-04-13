"use client";

import { petitionCaseAdapter } from "@/app/components/Case/Petition/PetitionCaseAdapter";
import { PetitionCaseUpdatePage } from "@rtc-database/shared";
import { useRouter } from "next/navigation";

const PetitionAddPage = () => {
  const router = useRouter();

  const goBackToList = () => {
    router.push("/user/cases/petition");
  };

  return (
    <PetitionCaseUpdatePage
      onClose={goBackToList}
      onCreate={goBackToList}
      onUpdate={goBackToList}
      adapter={petitionCaseAdapter}
    />
  );
};

export default PetitionAddPage;
