import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasPassword } from "./components/AccountManagement/AccountActions";
import Login from "./components/Login";
import { auth } from "./lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    const hasPasswordResult = await hasPassword();

    if (!hasPasswordResult.success) {
      redirect("/firstlogin");
    } else redirect("/user/dashboard");
  }

  return <Login />;
}
