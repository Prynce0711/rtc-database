"use client";

import PetitionEntryPage, {
  ReceiveDrawerType,
} from "@/app/components/Case/Petition/PetitionDrawer";
import { useRouter } from "next/navigation";

const PetitionAddPage = () => {
  const router = useRouter();

  return (
    <PetitionEntryPage
      type={ReceiveDrawerType.ADD}
      onClose={() => router.push("/user/cases/petition")}
    />
  );
};

export default PetitionAddPage;
