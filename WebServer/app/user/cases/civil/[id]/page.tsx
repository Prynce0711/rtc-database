import { civilCaseAdapter } from "@/app/components/Case/Civil/CivilCaseAdapter";
import { CivilDetailsPage } from "@rtc-database/shared";

const page = () => {
  return <CivilDetailsPage adapter={civilCaseAdapter} />;
};

export default page;
