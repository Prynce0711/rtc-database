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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center px-4">
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Regional Trial Court
          </h1>
          <p className="text-lg text-gray-700 font-semibold">
            Republic of the Philippines
          </p>
          <p className="text-sm text-gray-600 italic mt-1">"Batas at Bayan"</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8 border-t-4 border-blue-900">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Admin Login
          </h2>

          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                placeholder="admin@rtc.gov.ph"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-900 text-white py-3 rounded-md font-semibold hover:bg-blue-800 transition-colors shadow-lg text-lg"
            >
              Login as Admin
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">
                OR
              </span>
            </div>
          </div>

          {/* Staff Login Button */}
          <button
            type="button"
            onClick={onStaffLogin}
            className="w-full bg-white text-blue-900 border-2 border-blue-900 py-3 rounded-md font-semibold hover:bg-blue-50 transition-colors shadow-lg text-lg"
          >
            Continue as Staff
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>For authorized personnel only</p>
          <p className="mt-1">
            © 2026 Regional Trial Court - Republic of the Philippines
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
