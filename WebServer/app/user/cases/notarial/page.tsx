import Notarial from "@/app/components/Case/Notarial/Notarial";
import { requireUserRole } from "@/app/lib/requireUserRole";
import Roles from "@/app/lib/Roles";

const page = async () => {
  const role = await requireUserRole([Roles.ADMIN, Roles.NOTARIAL]);

  return <Notarial role={role} />;
};

export default page;
