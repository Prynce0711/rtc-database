import React, { useState } from "react";
import { getAuthClient } from "../../../lib/authClient";

interface Props {
  onSuccess: () => void;
  onBack: () => void;
}

const AdminLoginForm: React.FC<Props> = ({ onSuccess, onBack }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasError, setHasError] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // client-side email format validation
    const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    setEmailError(emailValid ? null : "Please enter a valid email address");
    setPasswordError(password.length > 0 ? null : "Password is required");
    if (!emailValid || password.length === 0) return;

    const { data, error } = await getAuthClient().signIn.email({
      email,
      password,
    });
    if (data) {
      onSuccess();
    } else if (error) {
      // try to guess which field failed from error message
      const msg = (error.message || "").toLowerCase();
      const emailRelated = /email|user|not found|no account/.test(msg);
      const passwordRelated = /password|invalid password|wrong password/.test(
        msg,
      );

      if (emailRelated && !passwordRelated) {
        setEmailError("Email not found");
      } else if (passwordRelated && !emailRelated) {
        setPasswordError("Incorrect password");
      } else {
        // ambiguous or generic auth error — mark both
        setEmailError("Invalid credentials");
        setPasswordError("Invalid credentials");
      }

      setHasError(true);
      setTimeout(() => setHasError(false), 1000);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-base-content mb-6 text-center">
        Admin Login
      </h2>

      <form
        onSubmit={handleSubmit}
        noValidate
        className={`space-y-6 ${hasError ? "border border-red-500 p-4 rounded" : ""}`}
      >
        <div>
          <label
            htmlFor="admin-email"
            className="block text-sm font-semibold text-base-content mb-2"
          >
            Email Address
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            onBlur={() => {
              const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
              setEmailError(
                emailValid ? null : "Please enter a valid email address",
              );
            }}
            className={`input input-bordered w-full ${emailError ? "input-error" : ""}`}
            placeholder="admin@rtc.gov.ph"
            required
          />
          {emailError && (
            <p className="text-sm text-red-600 mt-1">{emailError}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="admin-password"
            className="block text-sm font-semibold text-base-content mb-2"
          >
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(null);
            }}
            onBlur={() => {
              setPasswordError(
                password.length > 0 ? null : "Password is required",
              );
            }}
            className={`input input-bordered w-full ${passwordError ? "input-error" : ""}`}
            placeholder="Enter your password"
            required
          />
          {passwordError && (
            <p className="text-sm text-red-600 mt-1">{passwordError}</p>
          )}
        </div>

        <button
          type="submit"
          className={`btn w-full text-lg ${hasError ? "btn-error" : "btn-primary"}`}
        >
          {hasError ? "Login Failed" : "Login as Admin"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button className="link" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
};

export default AdminLoginForm;
