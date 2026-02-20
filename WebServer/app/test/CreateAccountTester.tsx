"use client";

import { useState } from "react";
import { sendMagicLink } from "./magicLinkActions";

const CreateAccountTester = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const result = await sendMagicLink(email);
    if (result.success) {
      setMessage({ type: "success", text: "Magic link sent successfully." });
      setEmail("");
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to send magic link.",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl">Magic Link Tester</h2>
          <p className="text-sm text-base-content/70">
            Send a sign-in magic link to an email address.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                className="input input-bordered"
                placeholder="user@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {message && (
              <div
                className={`alert ${
                  message.type === "success" ? "alert-success" : "alert-error"
                }`}
              >
                <span>{message.text}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateAccountTester;
