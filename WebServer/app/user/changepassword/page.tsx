import UpdatePassword, {
  UpdatePasswordType,
} from "../../components/UpdatePassword/UpdatePassword";

const page = () => {
  return <UpdatePassword type={UpdatePasswordType.CHANGE_PASSWORD} />;
};

export default page;
