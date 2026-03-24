"use client";

import ReceiveDrawer, {
  ReceiveDrawerType,
} from "@/app/components/Case/ReceivingLogs/ReceiveDrawer";
import { useRouter } from "next/navigation";

const ReceivingAddPage = () => {
  const router = useRouter();

  return (
    <ReceiveDrawer
      type={ReceiveDrawerType.ADD}
      onClose={() => router.push("/user/cases/receiving")}
    />
  );
};

export default ReceivingAddPage;
