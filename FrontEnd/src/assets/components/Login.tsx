import React, { useState } from "react";

interface LoginProps {
  onAdminLogin: () => void;
  onStaffLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onAdminLogin, onStaffLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Add validation here
    if (email && password) {
      onAdminLogin();
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img
              src="/SupremeCourtLogo.webp"
              alt="Supreme Court of the Philippines"
              className="w-32 h-32 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-base-content mb-2">
            Regional Trial Court
          </h1>
          <p className="text-lg text-base-content font-semibold">
            Republic of the Philippines
          </p>
          <p className="text-sm opacity-70 italic mt-1">"Batas at Bayan"</p>
        </div>

        {/* Login Form */}
        <div className="bg-base-100 rounded-lg shadow-xl p-8 border-t-4 border-primary">
          <h2 className="text-2xl font-bold text-base-content mb-6 text-center">
            Admin Login
          </h2>

          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-base-content mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full"
                placeholder="admin@rtc.gov.ph"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-base-content mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered w-full"
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full text-lg">
              Login as Admin
            </button>
          </form>

          {/* Divider */}
          <div className="divider">OR</div>

          {/* Staff Login Button */}
          <button
            type="button"
            onClick={onStaffLogin}
            className="btn btn-outline btn-primary w-full text-lg"
          >
            Continue as Staff
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
