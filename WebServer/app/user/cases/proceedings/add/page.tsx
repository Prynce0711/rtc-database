"use client";

import { specialProceedingAdapter } from "@/app/components/Case/SpecialProceedings/SpecialProceedingAdapter";
import { SpecialProceedingUpdatePage } from "@rtc-database/shared";
import { useRouter } from "next/navigation";

const ProceedingsAddPage = () => {
  const router = useRouter();

  return (
    <SpecialProceedingUpdatePage
      type="ADD"
      adapter={specialProceedingAdapter}
      onClose={() => router.push("/user/cases/proceedings")}
      onCreate={() => router.push("/user/cases/proceedings")}
      onUpdate={() => router.push("/user/cases/proceedings")}
    />
  );
};

export default ProceedingsAddPage;
