"use client";

import { SherriffCaseUpdatePage } from "@/app/components/Case/Sherriff/SherriffCaseUpdatePage";
import { useRouter } from "next/navigation";

const SheriffAddPage = () => {
  const router = useRouter();

  const goBackToList = () => {
    router.push("/user/cases/sheriff");
  };

  return (
    <SherriffCaseUpdatePage
      type="ADD"
      onCloseAction={goBackToList}
      onCreateAction={goBackToList}
      onUpdateAction={goBackToList}
    />
  );
};

export default SheriffAddPage;
