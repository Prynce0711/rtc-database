"use client";

import { authClient } from "@/app/lib/authClient";
import { isDarkMode, usePopup } from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const VerifyCode = () => {
  const router = useRouter();
  const statusPopup = usePopup();

  const [darkMode, setDarkMode] = useState(isDarkMode());
  const [method, setMethod] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const normalizedCode = useMemo(
    () => code.replace(/\D/g, "").slice(0, 6),
    [code],
  );
  const normalizedBackupCode = useMemo(() => backupCode.trim(), [backupCode]);

  useEffect(() => {
    const handleThemeChange = () => {
      setDarkMode(isDarkMode());
    };

    window.addEventListener("themeChange", handleThemeChange);
    return () => {
      window.removeEventListener("themeChange", handleThemeChange);
    };
  }, []);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (method === "totp" && normalizedCode.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    if (method === "backup" && !normalizedBackupCode) {
      setError("Enter one of your backup codes.");
      return;
    }

    setIsLoading(true);

    const { error: verifyError } =
      method === "totp"
        ? await authClient.twoFactor.verifyTotp({
            code: normalizedCode,
            trustDevice,
          })
        : await authClient.twoFactor.verifyBackupCode({
            code: normalizedBackupCode,
            disableSession: false,
            trustDevice,
          });

    setIsLoading(false);

    if (verifyError) {
      setError(verifyError.message || "Invalid verification code.");
      return;
    }

    statusPopup.showSuccess("Two-factor verification complete.");
    router.push("/user/dashboard");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black/90 px-4 py-12">
      <Image
        src="/ha.jpg"
        alt="Background"
        fill
        className={`pointer-events-none object-cover ${darkMode ? "opacity-20" : "opacity-30"}`}
        priority
      />

      <div className="relative z-10 mt-16 w-full max-w-md">
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="mb-6 flex justify-center">
            <motion.div
              className="group relative"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: 0.1,
              }}
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/20 blur-xl transition-all duration-300 group-hover:bg-primary/30"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.2, 0.3, 0.2],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <img
                src="/SupremeCourtLogo.webp"
                alt="Supreme Court of the Philippines"
                className="relative z-10 h-32 w-32 object-contain drop-shadow-lg"
              />
            </motion.div>
          </div>

          <h1
            className="mb-2 text-4xl font-bold tracking-tight text-white"
            style={{
              textShadow:
                "2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
            }}
          >
            Regional Trial Court
          </h1>

          <p
            className="text-lg font-semibold text-white/90"
            style={{
              textShadow:
                "2px 2px 6px rgba(0,0,0,0.8), 0 0 15px rgba(0,0,0,0.5)",
            }}
          >
            Republic of the Philippines
          </p>

          <p
            className="mt-2 text-sm font-medium italic text-white/90"
            style={{
              textShadow:
                "1px 1px 5px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.4)",
            }}
          >
            &quot;Batas at Bayan&quot;
          </p>
        </motion.div>

        <motion.div
          className="relative z-10 rounded-2xl border border-white/20 bg-linear-to-b from-white/90 to-white/60 p-8 shadow-xl"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <h2 className="mb-2 text-center text-2xl font-bold text-base-content">
            Verify Two-Factor Code
          </h2>
          <p className="mb-4 text-center text-xs font-medium text-warning">
            Use your authenticator app or a backup code to continue.
          </p>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-base-200/80 p-1">
            <button
              type="button"
              onClick={() => {
                setMethod("totp");
                setError("");
              }}
              className={[
                "btn btn-sm rounded-lg border-0",
                method === "totp" ? "btn-primary" : "btn-ghost",
              ].join(" ")}
            >
              Authenticator Code
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("backup");
                setError("");
              }}
              className={[
                "btn btn-sm rounded-lg border-0",
                method === "backup" ? "btn-primary" : "btn-ghost",
              ].join(" ")}
            >
              Backup Code
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                className="alert alert-error mb-6"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleVerify} className="space-y-5">
            {method === "totp" ? (
              <div>
                <label className="label font-semibold">
                  Authenticator Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  className="input input-bordered w-full bg-base-200 text-center font-mono text-2xl tracking-[0.35em]"
                />
              </div>
            ) : (
              <div>
                <label className="label font-semibold">Backup Code</label>
                <input
                  type="text"
                  value={backupCode}
                  onChange={(event) => setBackupCode(event.target.value)}
                  autoComplete="one-time-code"
                  placeholder="Enter backup code"
                  className="input input-bordered w-full bg-base-200 font-mono text-sm"
                />
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary mt-0.5"
                checked={trustDevice}
                onChange={() => setTrustDevice((value) => !value)}
              />
              <span className="text-sm text-base-content/80">
                Trust this device for 30 days
              </span>
            </label>

            <button
              type="submit"
              disabled={
                isLoading ||
                (method === "totp"
                  ? normalizedCode.length !== 6
                  : !normalizedBackupCode)
              }
              className="btn btn-primary mt-6 w-full"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>Verifying...</span>
                </>
              ) : method === "totp" ? (
                "Verify Code"
              ) : (
                "Verify Backup Code"
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn btn-ghost w-full"
              disabled={isLoading}
            >
              Back to Sign In
            </button>
          </form>

          <div className="divider mt-8 text-xs text-base-content/70">
            Two-Factor Security
          </div>

          <p className="text-center text-xs opacity-60">
            If your code does not work, check your device time and try again.
          </p>
        </motion.div>

        <motion.div className="mt-3 text-center text-xs text-base-content/80">
          © 2026 Regional Trial Court
        </motion.div>
      </div>
    </div>
  );
};

export default VerifyCode;
