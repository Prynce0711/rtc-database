"use client";

import NotarialCommissionDrawer, {
  NotarialCommissionDrawerType,
} from "@/app/components/NotarialCommission/NotarialCommissionDrawer";
import { useRouter } from "next/navigation";

const NotarialCommissionAddPage = () => {
  const router = useRouter();

  return (
    <NotarialCommissionDrawer
      type={NotarialCommissionDrawerType.ADD}
      onClose={() => router.push("/user/notarial-commission")}
    />
  );
};

export default NotarialCommissionAddPage;
