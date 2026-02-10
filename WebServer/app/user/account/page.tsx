import AccountDashboard from "@/app/components/AccountManagement/AccountDashboard";
import { auth } from "@/app/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";

const page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  /* ===== NOT LOGGED IN ===== */
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center">
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>

          <h1 className="text-5xl font-semibold text-slate-900 mb-4">
            Unauthorized
          </h1>
          <p className="text-xl text-slate-500 mb-10">
            You need to be signed in to access this page.
          </p>

          <Link
            href="/login"
            className="inline-block px-10 py-4 bg-slate-900 text-white text-lg font-medium rounded-xl hover:bg-slate-800 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  /* ===== ADMIN ONLY ===== */
  if (session.user.role !== "admin") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center">
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
            Access Denied
          </h1>
          <p className="text-xl text-slate-500 mb-10">Admin access only.</p>

          <Link
            href="/"
            className="inline-block px-10 py-4 bg-slate-900 text-white text-lg font-medium rounded-xl hover:bg-slate-800 transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  /* ===== ADMIN DASHBOARD ===== */
  return <AccountDashboard />;
};

export default page;
