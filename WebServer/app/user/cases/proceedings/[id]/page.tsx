"use client";

import { specialProceedingAdapter } from "@/app/components/Case/SpecialProceedings/SpecialProceedingAdapter";
import { SpecialProceedingDetailsPage } from "@rtc-database/shared";

const page = () => {
  return <SpecialProceedingDetailsPage adapter={specialProceedingAdapter} />;
};

export default page;
