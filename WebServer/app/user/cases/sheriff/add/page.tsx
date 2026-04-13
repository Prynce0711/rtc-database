"use client";

import { sherriffCaseAdapter } from "@/app/components/Case/Sherriff/SherriffCaseAdapter";
import { SherriffCaseUpdatePage } from "@rtc-database/shared";
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
      adapter={sherriffCaseAdapter}
    />
  );
};

export default SheriffAddPage;
