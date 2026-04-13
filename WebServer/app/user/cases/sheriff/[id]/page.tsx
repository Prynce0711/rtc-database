import { sherriffCaseAdapter } from "@/app/components/Case/Sherriff/SherriffCaseAdapter";
import { SheriffDetailsPage } from "@rtc-database/shared";

const Page = () => {
  return <SheriffDetailsPage adapter={sherriffCaseAdapter} />;
};

export default Page;
