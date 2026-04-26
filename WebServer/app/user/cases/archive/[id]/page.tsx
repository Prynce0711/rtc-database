import archiveAdapter from "@/app/components/Case/Archives/ArchiveAdapter";
import { ArchiveDetailsPage } from "@rtc-database/shared";

const Page = () => {
  return <ArchiveDetailsPage adapter={archiveAdapter} />;
};

export default Page;
