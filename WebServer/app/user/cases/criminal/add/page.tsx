"use client";

import CriminalCaseUpdatePage from "@/app/components/Case/Criminal/CriminalCaseUpdatePage";
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
    />
  );
};

export default CriminalAddPage;
