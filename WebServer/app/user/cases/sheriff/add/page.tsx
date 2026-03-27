"use client";

import SherriffDrawer, {
  SherriffDrawerType,
} from "@/app/components/Case/Sherriff/SherriffDrawer";
import { useRouter } from "next/navigation";

const SheriffAddPage = () => {
  const router = useRouter();

  return (
    <SherriffDrawer
      type={SherriffDrawerType.ADD}
      onClose={() => router.push("/user/cases/sheriff")}
    />
  );
};

export default SheriffAddPage;
