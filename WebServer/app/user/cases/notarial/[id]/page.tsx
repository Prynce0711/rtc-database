import NotarialDetailsPage from "@/app/components/Case/Notarial/NotarialDetailsPage";
import { requireUserRole } from "@/app/lib/requireUserRole";
import Roles from "@/app/lib/Roles";

const page = async () => {
  await requireUserRole([Roles.ADMIN, Roles.NOTARIAL]);

  return <NotarialDetailsPage />;
};

export default page;
