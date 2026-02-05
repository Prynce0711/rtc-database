"use client";

import { signIn, useSession } from "@/app/lib/authClient";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      router.push("/user/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data, error: signInError } = await signIn.email({
        email,
        password,
      });

      if (signInError) {
        setError("Invalid email or password. Please try again.");
        setIsLoading(false);
        return;
      }

      router.push("/user/dashboard");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-300 to-base-200 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/30 transition-all duration-300"></div>
              <img
                src="/SupremeCourtLogo.webp"
                alt="Supreme Court of the Philippines"
                className="w-32 h-32 object-contain relative z-10 drop-shadow-lg"
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-base-content mb-2 tracking-tight">
            Regional Trial Court
          </h1>
          <p className="text-lg text-base-content/90 font-semibold">
            Republic of the Philippines
          </p>
          <p className="text-sm text-base-content/60 italic mt-2 font-medium">
            "Batas at Bayan"
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-base-100 rounded-2xl shadow-2xl p-8 border border-base-300 backdrop-blur-sm transform transition-all duration-300 hover:shadow-3xl">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-base-content text-center">
              Sign In
            </h2>
            <p className="text-sm text-base-content/60 text-center mt-2">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-error mb-6 animate-shake shadow-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="form-control">
              <label htmlFor="email" className="label">
                <span className="label-text font-semibold text-base">
                  Email Address
                </span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full focus:input-primary transition-all duration-200 bg-base-200"
                placeholder="admin@rtc.gov.ph"
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-control">
              <label htmlFor="password" className="label">
                <span className="label-text font-semibold text-base">
                  Password
                </span>
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered w-full focus:input-primary transition-all duration-200 bg-base-200"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full text-base font-semibold mt-6 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>Signing In...</span>
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="divider text-xs text-base-content/50 mt-8">
            Secure Login
          </div>

          <div className="text-center">
            <p className="text-xs text-base-content/60">
              Protected by enterprise-grade security
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-base-content/50">
          <p>© 2026 Regional Trial Court. All rights reserved.</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-5px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(5px);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Login;
