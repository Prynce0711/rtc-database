"use client";

import { specialProceedingAdapter } from "@/app/components/Case/SpecialProceedings/SpecialProceedingAdapter";
import { Proceedings } from "@rtc-database/shared";

export default function Page() {
  return <Proceedings adapter={specialProceedingAdapter} />;
}
