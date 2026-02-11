import AttorneyDashboard from "@/app/components/Attorney/AttorneyDashboard";
import AdminDashboard from "@/app/components/Dashboard/AdminDashboard";
import StaffDashboard from "@/app/components/Dashboard/StaffDashboard";
import { auth } from "@/app/lib/auth";
import Roles from "@/app/lib/Roles";
import { headers } from "next/headers";

const page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return (
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h1 className="text-5xl font-semibold text-slate-900 mb-4">
              Unauthorized
            </h1>
            <p className="text-xl text-slate-500 mb-10 max-w-lg mx-auto">
              You need to be signed in to access this page.
            </p>
            <a
              href="/login"
              className="inline-block px-10 py-4 bg-slate-900 text-white text-lg font-medium rounded-xl hover:bg-slate-800 transition-all duration-200"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (session.user.role === Roles.ADMIN) {
    return <AdminDashboard />;
  } else if (session.user.role === Roles.ATTY) {
    return <AttorneyDashboard />;
  } else {
    return <StaffDashboard staffId={session.user.id} />;
  }
};

export default page;
