"use client";

import { NotarialUpdatePage } from "@/app/components/Case/Civil/CivilCaseUpdatePage";
import { useRouter } from "next/navigation";

const CivilAddPage = () => {
  const router = useRouter();

  const goBackToList = () => {
    router.push("/user/cases/civil");
  };

  return (
    <NotarialUpdatePage
      type="ADD"
      onCloseAction={goBackToList}
      onCreateAction={goBackToList}
      onUpdateAction={goBackToList}
    />
  );
};

export default CivilAddPage;
