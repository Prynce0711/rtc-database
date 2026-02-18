"use client";
import { sendEmail } from "@/app/lib/email";
import { useState } from "react";

export default function TextSender() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await sendEmail(to, subject, text);
      if (result) {
        setMessage({ type: "success", text: "Email sent successfully!" });
        setTo("");
        setSubject("");
        setText("");
      } else {
        setMessage({ type: "error", text: "Failed to send email" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-4">
      <div className="card bg-base-100 shadow-xl w-full max-w-md">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold mb-6">Send Message</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Recipient Email
                </span>
              </label>
              <input
                type="email"
                placeholder="recipient@example.com"
                className="input input-bordered w-full"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Subject</span>
              </label>
              <input
                type="text"
                placeholder="Email subject"
                className="input input-bordered w-full"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Message</span>
              </label>
              <textarea
                placeholder="Type your message here..."
                className="textarea textarea-bordered w-full h-32 resize-none"
                value={text}
                onChange={(e) => setText(e.target.value)}
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
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Sending...
                </>
              ) : (
                "Send Message"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
