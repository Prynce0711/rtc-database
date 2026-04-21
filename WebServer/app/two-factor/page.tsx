import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import VerifyCode from "../components/Login/VerifyCode";

const page = async () => {
  const cookieStore = await cookies();
  const hasTwoFactorCookie = Boolean(
    cookieStore.get("better-auth.two_factor")?.value ||
    cookieStore.get("__Secure-better-auth.two_factor")?.value,
  );

  if (!hasTwoFactorCookie) {
    redirect("/");
  }

  return <VerifyCode />;
};

export default page;
