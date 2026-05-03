import NotarialCommissionDashboard from "@/app/components/NotarialCommission/NotarialCommissionDashboard";
import { auth } from "@/app/lib/auth";
import Roles from "@/app/lib/Roles";
import { headers } from "next/headers";
import Link from "next/link";

const AccessMessage = ({
  title,
  message,
  href,
  action,
}: {
  title: string;
  message: string;
  href: string;
  action: string;
}) => (
  <div className="min-h-screen bg-white flex items-center justify-center px-4">
    <div className="max-w-2xl w-full text-center">
      <div className="mb-12">
        <svg
          className="w-40 h-40 text-slate-300 mx-auto mb-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h1 className="text-5xl font-semibold text-slate-900 mb-4">
          {title}
        </h1>
        <p className="text-xl text-slate-500 mb-10 max-w-lg mx-auto">
          {message}
        </p>
        <Link
          href={href}
          className="inline-block px-10 py-4 bg-slate-900 text-white text-lg font-medium rounded-xl hover:bg-slate-800 transition-all duration-200"
        >
          {action}
        </Link>
      </div>
    </div>
  </div>
);

const page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return (
      <AccessMessage
        title="Unauthorized"
        message="You need to be signed in to access this page."
        href="/login"
        action="Sign In"
      />
    );
  }

  if (
    session.user.role === Roles.ADMIN ||
    session.user.role === Roles.NOTARIAL
  ) {
    return <NotarialCommissionDashboard />;
  }

  return (
    <AccessMessage
      title="Access Denied"
      message="You do not have permission to access this page."
      href="/"
      action="Go Home"
    />
  );
};

export default page;
