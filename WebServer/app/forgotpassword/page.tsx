"use client";

import { isDarkMode } from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(isDarkMode());

  useEffect(() => {
    const handleThemeChange = () => setDarkMode(isDarkMode());
    window.addEventListener("themeChange", handleThemeChange);
    return () => window.removeEventListener("themeChange", handleThemeChange);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsLoading(true);

    try {
      const redirectTo = `${window.location.origin}/resetpassword`;
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo }),
      });

      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.message || "Unable to send reset email.");
      }

      setStatus(
        data?.message ||
          "If this email exists in our system, check your email for the reset link.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send reset email.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative bg-black/90">
      <Image
        src="/ha.jpg"
        alt="Background"
        fill
        className={`object-cover ${darkMode ? "opacity-20" : "opacity-30"} pointer-events-none`}
        priority
      />

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <Image
            src="/SupremeCourtLogo.webp"
            alt="Supreme Court of the Philippines"
            width={112}
            height={112}
            className="w-28 h-28 object-contain mx-auto drop-shadow-lg"
          />
          <h1
            className="text-4xl font-bold text-white mt-6"
            style={{ textShadow: "2px 2px 8px rgba(0,0,0,0.8)" }}
          >
            Regional Trial Court
          </h1>
          <p className="text-white/90 font-semibold mt-2">
            Republic of the Philippines
          </p>
        </div>

        <motion.div
          className="rounded-2xl p-8 bg-linear-to-b from-white/90 to-white/60 border border-white/20 shadow-xl"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          <h2 className="text-3xl font-bold text-center">Forgot Password</h2>
          <p className="text-sm text-base-content/80 text-center mt-2 mb-8">
            Enter your account email. We will send a secure reset link.
          </p>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                className="alert alert-error mb-5"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className="text-sm">{error}</span>
              </motion.div>
            )}
            {status && (
              <motion.div
                className="alert alert-success mb-5"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className="text-sm">{status}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-control">
              <label htmlFor="email" className="label">
                <span className="label-text font-semibold">Email Address</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input input-bordered w-full bg-base-200"
                placeholder="admin@rtc.gov.ph"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  <span>Sending...</span>
                </>
              ) : (
                "Send Reset Email"
              )}
            </button>
          </form>

          <div className="divider text-xs text-base-content/70 mt-8">
            Account Access
          </div>

          <Link href="/" className="btn btn-ghost w-full">
            Back to Sign In
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
