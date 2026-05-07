import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasPassword } from "./components/AccountManagement/AccountActions";
import Login from "./components/Login/Login";
import { auth } from "./lib/auth";
import { AUTH_REDIRECT_PARAM, getSafeRedirectTarget } from "./lib/redirectTarget";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const callbackParam = resolvedSearchParams[AUTH_REDIRECT_PARAM];
  const callbackUrl = Array.isArray(callbackParam)
    ? callbackParam[0]
    : callbackParam;
  const redirectTarget = getSafeRedirectTarget(callbackUrl);
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    const hasPasswordResult = await hasPassword();

    if (!hasPasswordResult.success) {
      redirect("/firstlogin");
    } else redirect(redirectTarget);
  }

  return <Login />;
}
