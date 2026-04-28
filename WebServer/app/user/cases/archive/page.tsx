import archiveAdapter from "@/app/components/Case/Archives/ArchiveAdapter";
import { requireUserRole } from "@/app/lib/requireUserRole";
import AppRoles from "@/app/lib/Roles";
import { ArchivePage, Roles as SharedRoles } from "@rtc-database/shared";

export default async function Page() {
  const role = await requireUserRole([
    AppRoles.ADMIN,
    AppRoles.NOTARIAL,
    AppRoles.ARCHIVE,
  ]);

  return (
    <ArchivePage
      adapter={archiveAdapter}
      role={role as SharedRoles}
    />
  );
}
