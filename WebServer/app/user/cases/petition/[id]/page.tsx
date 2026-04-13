import { petitionCaseAdapter } from "@/app/components/Case/Petition/PetitionCaseAdapter";
import { PetitionCaseDetailsPage } from "@rtc-database/shared";

const page = () => {
  return <PetitionCaseDetailsPage adapter={petitionCaseAdapter} />;
};

export default page;
