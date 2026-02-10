import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "./lib/auth";

const NotFound = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  const hasSession = session?.user ? true : false;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-slate-800 tracking-tight">
            404
          </h1>
        </div>

        <h2 className="text-3xl md:text-4xl font-semibold text-slate-800 mb-4">
          Page Not Found
        </h2>
        <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
          Sorry, we could not find the page you are looking for. It might have
          been moved or deleted.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href={hasSession ? "/user/dashboard" : "/"}
            className="px-8 py-3 bg-white text-slate-700 font-medium rounded-lg border-2 border-slate-300 hover:border-slate-400 transition-colors duration-200 pointer-events-auto"
          >
            {hasSession ? "Go to Dashboard" : "Go to Home"}
          </Link>
        </div>

        <div className="mt-12 text-slate-400">
          <svg
            className="w-64 h-64 mx-auto opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
