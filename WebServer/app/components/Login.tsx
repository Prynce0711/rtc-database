"use client";

import { signIn } from "@/app/lib/authClient";
import {
  AnimatePresence,
  easeInOut,
  motion,
  useAnimation,
} from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { isDarkMode } from "../lib/utils";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const [darkMode, setDarkMode] = useState(isDarkMode());
  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.7, delay: 0.2, ease: easeInOut },
    },
    transitioning: {
      scale: 1.06,
      y: -40,
      opacity: 0.98,
      transition: { duration: 0.6, ease: easeInOut },
    },
    shake: {
      x: [0, -15, 15, -12, 12, -8, 8, -4, 4, 0],
      rotate: [0, -1, 1, -1, 1, 0],
      transition: { duration: 0.7 },
    },
  };

  useEffect(() => {
    const handleThemeChange = () => {
      setDarkMode(isDarkMode());
    };
    window.addEventListener("themeChange", handleThemeChange);
    return () => {
      window.removeEventListener("themeChange", handleThemeChange);
    };
  }, []);

  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined") {
        return localStorage.getItem("rememberMe") === "true";
      }
    } catch {
      /* ignore */
    }
    return false;
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && rememberMe) {
        const remembered = localStorage.getItem("rememberedEmail") || "";
        if (remembered) setEmail(remembered);
      }
    } catch {
      /* ignore */
    }
  }, [rememberMe]);

  const cardControls = useAnimation();
  const overlayControls = useAnimation();

  useEffect(() => {
    // reveal card on mount
    void cardControls.start("visible");
  }, [cardControls]);

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
      let res: any;
      try {
        res = await signIn.email({ email, password });
      } catch (e: any) {
        setIsLoading(false);
        const status = e?.response?.status ?? e?.status ?? null;
        if (status && status >= 500) {
          setError("Server error. Please try again later.");
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
        return;
      }

      const { data, error: signInError } = res;

      if (signInError) {
        setError("Invalid email or password. Please try again.");
        setIsLoading(false);

        await cardControls.start("shake");

        return;
      }
      // smooth transition kapag success
      try {
        void overlayControls.start({
          opacity: 1,
          transition: { duration: 0.45 },
        });

        await cardControls.start("transitioning");
        await new Promise((r) => setTimeout(r, 120));
      } catch {}

      return;

      // smooth transition: animate card then fade overlay into view before navigating
      try {
        // fade in subtle overlay
        void overlayControls.start({
          opacity: 1,
          transition: { duration: 0.45 },
        });
        // animate card lift/scale
        await cardControls.start("transitioning");
        // small delay to let overlay settle
        await new Promise((r) => setTimeout(r, 120));
      } catch {}

      // reset attempts on successful sign in

      try {
        if (typeof window !== "undefined") {
          if (rememberMe) {
            localStorage.setItem("rememberMe", "true");
            localStorage.setItem("rememberedEmail", email);
          } else {
            localStorage.removeItem("rememberMe");
            localStorage.removeItem("rememberedEmail");
          }
        }
      } catch {}
      router.push("/user/dashboard");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative  bg-black/90">
      {/* <Image
        src="/cardo.jpg"
        alt="Background"
        fill
        className={`bg-repeat ${darkMode ? "opacity-20" : "opacity-90"} pointer-events-none`}
        priority
      /> */}
      {/* <Image
        src="/jere.jpg"
        alt="Brand"
        width={300}
        height={300}
        className="absolute bottom-4 right-4 opacity-70 pointer-events-none select-none"
      /> */}

      <Image
        src="/cardo.jpg"
        alt="Background"
        fill
        className={`object-cover ${darkMode ? "opacity-20" : "opacity-30"} pointer-events-none`}
        priority
      />
      <div className="max-w-md w-full relative z-10">
        {/* full-screen overlay used during transition */}
        <motion.div
          className="fixed inset-0 z-20 bg-base-100"
          initial={{ opacity: 0 }}
          animate={overlayControls}
          style={{ pointerEvents: "none" }}
        />

        {/* Logo and Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <div className="flex justify-center mb-6">
            <motion.div
              className="relative group"
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
                className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/30 transition-all duration-300"
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
                className="w-32 h-32 object-contain relative z-10 drop-shadow-lg"
              />
            </motion.div>
          </div>

          <motion.h1
            className="text-4xl font-bold text-white mb-2 tracking-tight"
            style={{
              textShadow:
                "2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Regional Trial Court
          </motion.h1>

          <motion.p
            className="text-lg text-white/90 font-semibold"
            style={{
              textShadow:
                "2px 2px 6px rgba(0,0,0,0.8), 0 0 15px rgba(0,0,0,0.5)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Republic of the Philippines
          </motion.p>

          <motion.p
            className="text-sm text-white/90 italic mt-2 font-medium"
            style={{
              textShadow:
                "1px 1px 5px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.4)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.5 }}
          >
            &quot;Batas at Bayan&quot;
          </motion.p>
        </motion.div>

        {/* Login Form */}
        <motion.div
          className="
relative z-10
rounded-2xl
p-8
bg-linear-to-b from-white/90 to-white/60
border border-white/20
shadow-xl
"
          variants={cardVariants}
          initial="hidden"
          animate={cardControls}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-3xl font-bold text-base-content text-center">
              Sign In
            </h2>
            <p className="text-sm text-base-content/90 text-center mt-2">
              Enter your credentials to access your account
            </p>
          </motion.div>

          {/* Error Alert */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key={error}
                className="alert alert-error mb-6 shadow-lg"
                initial={{ x: -30, opacity: 0, scale: 0.9 }}
                animate={{
                  x: [-30, 10, -8, 6, -4, 2, 0],
                  opacity: 1,
                  scale: 1,
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  duration: 0.7,
                  ease: "easeInOut",
                }}
              >
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
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="space-y-5">
            <motion.div
              className="form-control"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
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
                className="input input-bordered w-full focus:input-primary transition-all duration-200 bg-base-200 focus:scale-[1.02]"
                placeholder="admin@rtc.gov.ph"
                required
                disabled={isLoading}
              />
            </motion.div>

            <motion.div
              className="form-control"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <label htmlFor="password" className="label">
                <span className="label-text font-semibold text-base">
                  Password
                </span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input input-bordered w-full focus:input-primary transition-all duration-200 bg-base-200 pr-12 focus:scale-[1.02]"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />

                <motion.button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/60 hover:text-base-content transition"
                  disabled={isLoading}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </motion.button>
              </div>
            </motion.div>

            <motion.div
              className="flex items-center gap-2 justify-start w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <input
                id="remember"
                type="checkbox"
                className="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  const v = e.target.checked;
                  setRememberMe(v);
                  try {
                    if (typeof window !== "undefined") {
                      localStorage.setItem("rememberMe", String(v));
                      if (v) localStorage.setItem("rememberedEmail", email);
                      else localStorage.removeItem("rememberedEmail");
                    }
                  } catch {}
                }}
              />
              <label htmlFor="remember" className="text-sm cursor-pointer">
                Remember me
              </label>
            </motion.div>

            <motion.button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full text-base font-semibold mt-6 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-70"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>Signing In...</span>
                </>
              ) : (
                "Sign In"
              )}
            </motion.button>
          </form>

          <div className="divider text-xs text-base-content/70 mt-8">
            Authorized Access Only
          </div>

          <div className="text-center">
            <p className="text-xs text-base-content/80 mt-3">
              Regional Trial Court © 2026
            </p>
          </div>
        </motion.div>

        {/* Footer */}
      </div>
    </div>
  );
};

export default Login;
