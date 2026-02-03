import React, { useState } from "react";
import { getAuthClient } from "../../../lib/auth-client";

interface Props {
  onSuccess: () => void;
}

const StaffLoginForm: React.FC<Props> = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasError, setHasError] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // validate email format and password presence first
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
        setEmailError("Invalid credentials");
        setPasswordError("Invalid credentials");
      }

      setHasError(true);
      setTimeout(() => setHasError(false), 1000);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`space-y-4 ${hasError ? "border border-red-500 p-4 rounded" : ""}`}
    >
      <div>
        <label className="block text-sm font-semibold mb-1">Email</label>
        <input
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
          required
          className={`input input-bordered w-full ${emailError ? "input-error" : ""}`}
        />
        {emailError && (
          <p className="text-sm text-red-600 mt-1">{emailError}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Password</label>
        <input
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
          required
          className={`input input-bordered w-full ${passwordError ? "input-error" : ""}`}
        />
        {passwordError && (
          <p className="text-sm text-red-600 mt-1">{passwordError}</p>
        )}
      </div>

      <button
        type="submit"
        className={`btn w-full ${hasError ? "btn-error" : "btn-primary"}`}
      >
        {hasError ? "Login Failed" : "Login"}
      </button>
    </form>
  );
};

export default StaffLoginForm;
