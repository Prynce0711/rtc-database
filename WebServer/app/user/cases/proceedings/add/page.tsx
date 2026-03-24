"use client";

import SpecialProceedingDrawer from "@/app/components/Case/SpecialProceedings/SpecialProceedingDrawer";
import { useRouter } from "next/navigation";

const ProceedingsAddPage = () => {
  const router = useRouter();

  return (
    <SpecialProceedingDrawer
      type="ADD"
      onClose={() => router.push("/user/cases/proceedings")}
    />
  );
};

export default ProceedingsAddPage;
