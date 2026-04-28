import archiveAdapter from "@/app/components/Case/Archives/ArchiveAdapter";
import { requireUserRole } from "@/app/lib/requireUserRole";
import Roles from "@/app/lib/Roles";
import { ArchiveDetailsPage } from "@rtc-database/shared";

const Page = async () => {
  await requireUserRole([Roles.ADMIN, Roles.NOTARIAL, Roles.ARCHIVE]);

  return <ArchiveDetailsPage adapter={archiveAdapter} />;
};

export default Page;
