"use client";

import recievingLogsAdapter from "@/app/components/Case/ReceivingLogs/RecievingLogsAdapter";
import { ReceiveDrawerType, ReceivingDrawer } from "@rtc-database/shared";
import { useRouter } from "next/navigation";

const ReceivingAddPage = () => {
  const router = useRouter();

  const goBackToList = () => {
    router.push("/user/cases/receiving");
  };

  return (
    <ReceivingDrawer
      adapter={recievingLogsAdapter}
      type={ReceiveDrawerType.ADD}
      onClose={goBackToList}
      onCreate={goBackToList}
      onUpdate={goBackToList}
    />
  );
};

export default ReceivingAddPage;
