import NewCriminalCaseModal from "@/app/components/Case/Criminal/CriminalCaseDrawer";
import { getCriminalCaseById } from "@/app/components/Case/Criminal/CriminalCasesActions";
import ErrorPopup from "@/app/components/Popup/ErrorPopup";
import { auth } from "@/app/lib/auth";
import Roles from "@/app/lib/Roles";
import { headers } from "next/headers";

const page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user) {
    return <ErrorPopup message="You must be logged in to view this page." />;
  }

  if (session.user.role !== Roles.ADMIN) {
    return (
      <ErrorPopup message="You do not have permission to view this page." />
    );
  }

  const { id } = await params;
  const caseResult = await getCriminalCaseById(id);
  if (!caseResult.success) {
    return <ErrorPopup message={caseResult.error || "Case not found."} />;
  }

  console.log("Loaded case for editing:", caseResult.result);

  return <NewCriminalCaseModal selectedCase={caseResult.result} />;
};

export default page;
