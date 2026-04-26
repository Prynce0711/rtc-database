import archiveAdapter from "@/app/components/Case/Archives/ArchiveAdapter";
import { ArchiveUpdatePage } from "@rtc-database/shared";

const Page = () => {
  return <ArchiveUpdatePage adapter={archiveAdapter} mode="EDIT" />;
};

export default Page;
