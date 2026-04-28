import archiveAdapter from "@/app/components/Case/Archives/ArchiveAdapter";
import { requireUserRole } from "@/app/lib/requireUserRole";
import Roles from "@/app/lib/Roles";
import { ArchiveUpdatePage } from "@rtc-database/shared";

const Page = async () => {
  await requireUserRole([Roles.ADMIN, Roles.NOTARIAL, Roles.ARCHIVE]);

  return <ArchiveUpdatePage adapter={archiveAdapter} mode="ADD" />;
};

export default Page;
