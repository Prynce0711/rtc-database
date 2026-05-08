"use client";

import { isDarkMode } from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import RequirementUI from "../components/UpdatePassword/RequirementUI";
import StrengthMeter from "../components/UpdatePassword/StrengthMeter";

const ResetPasswordPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const urlError = searchParams.get("error") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(
    urlError ? "This reset link is invalid or expired." : "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(isDarkMode());

  useEffect(() => {
    const handleThemeChange = () => setDarkMode(isDarkMode());
    window.addEventListener("themeChange", handleThemeChange);
    return () => window.removeEventListener("themeChange", handleThemeChange);
  }, []);

  const strengthChecks = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  );
  const checks = {
    ...strengthChecks,
    match: password !== "" && password === confirm,
  };
  const isValid = token !== "" && Object.values(checks).every(Boolean);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is invalid or expired.");
      return;
    }

    if (!isValid) {
      setError("Enter a valid matching password.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.message || "Unable to reset password.");
      }

      router.push("/");
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to reset password.",
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
          <h2 className="text-3xl font-bold text-center">Reset Password</h2>
          <p className="text-sm text-base-content/80 text-center mt-2 mb-8">
            Choose a new password for your account.
          </p>

          <AnimatePresence>
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
          </AnimatePresence>

          {!token ? (
            <Link href="/forgotpassword" className="btn btn-primary w-full">
              Request New Reset Link
            </Link>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label font-semibold">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input input-bordered w-full pr-12 bg-base-200"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-primary transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <FiEyeOff className="w-5 h-5" />
                    ) : (
                      <FiEye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {password && (
                <StrengthMeter
                  strength={
                    Object.values(strengthChecks).filter(Boolean).length
                  }
                />
              )}

              <div>
                <label className="label font-semibold">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="input input-bordered w-full pr-12 bg-base-200"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-primary transition-colors"
                    disabled={isLoading}
                  >
                    {showConfirm ? (
                      <FiEyeOff className="w-5 h-5" />
                    ) : (
                      <FiEye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <RequirementUI
                  ok={checks.length}
                  text="Minimum 8 characters"
                />
                <RequirementUI
                  ok={checks.uppercase}
                  text="One uppercase letter"
                />
                <RequirementUI ok={checks.number} text="One number" />
                <RequirementUI
                  ok={checks.special}
                  text="One special character"
                />
                <RequirementUI ok={checks.match} text="Passwords match" />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!isValid || isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  "Reset Password"
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
