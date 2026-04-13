import recievingLogsAdapter from "@/app/components/Case/ReceivingLogs/RecievingLogsAdapter";
import { ReceivingDetailsPage } from "@rtc-database/shared";

const page = () => {
  return <ReceivingDetailsPage adapter={recievingLogsAdapter} />;
};

export default page;
