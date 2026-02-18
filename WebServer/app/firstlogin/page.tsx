import UpdatePassword, {
  UpdatePasswordType,
} from "@/app/components/UpdatePassword/UpdatePassword";
const page = () => {
  return <UpdatePassword type={UpdatePasswordType.FIRST_LOGIN} />;
};

export default page;
