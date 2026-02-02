import React from "react";

const Footer = () => {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Security Notice */}
        <div className="mb-4 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-md bg-amber-50 px-4 py-2 border border-amber-200">
            <svg
              className="h-4 w-4 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span className="text-sm font-medium text-amber-800">
              Restricted Access - Authorized Personnel Only
            </span>
          </div>
        </div>

        {/* Copyright & Legal */}
        <div className="mt-4 border-t border-gray-200 pt-4 text-center">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Regional Trial Court. All rights
            reserved.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            This system contains confidential information and is intended solely
            for authorized use. Unauthorized access or use is strictly
            prohibited and may be subject to legal action.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
