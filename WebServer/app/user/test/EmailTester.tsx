"use client";

import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { getGlobalSmtpSettings, sendEmailWithSmtp } from "./EmailTesterActions";

type FormState = {
  smtpHost: string;
  smtpPort: string;
  secure: boolean;
  senderName: string;
  senderEmail: string;
  senderPassword: string;
  to: string;
  subject: string;
  text: string;
};

const initialFormState: FormState = {
  smtpHost: "smtp.gmail.com",
  smtpPort: "465",
  secure: true,
  senderName: "",
  senderEmail: "",
  senderPassword: "",
  to: "",
  subject: "SMTP Test Email",
  text: "This is a test email from RTC Database.",
};

export default function EmailTester() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    const parsedPort = Number(form.smtpPort);
    if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
      setResult({ type: "error", message: "SMTP port must be a valid number" });
      setLoading(false);
      return;
    }

    const response = await sendEmailWithSmtp({
      smtpHost: form.smtpHost.trim(),
      smtpPort: parsedPort,
      secure: form.secure,
      senderName: form.senderName.trim(),
      senderEmail: form.senderEmail.trim(),
      senderPassword: form.senderPassword,
      to: form.to.trim(),
      subject: form.subject.trim(),
      text: form.text,
    });

    if (!response.success) {
      setResult({
        type: "error",
        message: response.error || "Failed to send test email",
      });
      setLoading(false);
      return;
    }

    const accepted = response.result.accepted.length;
    const rejected = response.result.rejected.length;
    setResult({
      type: "success",
      message: `Email sent. Accepted: ${accepted}, Rejected: ${rejected}`,
    });
    setLoading(false);
  };

  const useCurrentGlobalSettings = async () => {
    setLoading(true);
    setResult(null);

    const response = await getGlobalSmtpSettings();
    if (!response.success) {
      setResult({
        type: "error",
        message: response.error || "Failed to load current global settings",
      });
      setLoading(false);
      return;
    }

    setForm((prev) => ({
      ...prev,
      smtpHost: response.result.smtpHost,
      smtpPort: response.result.smtpPort,
      secure: response.result.secure,
      senderName: response.result.senderName,
      senderEmail: response.result.senderEmail,
      senderPassword: response.result.senderPassword,
    }));

    setResult({
      type: "success",
      message: "Loaded SMTP values from global System Settings",
    });
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <h3 className="text-lg font-semibold">SMTP Email Tester</h3>
        <p className="text-sm text-base-content/70 mt-1">
          Change SMTP settings below, then send a test email.
        </p>
        <div className="mt-3">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={useCurrentGlobalSettings}
            disabled={loading}
          >
            Use Current Global Settings
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`alert ${
            result.type === "success" ? "alert-success" : "alert-error"
          }`}
        >
          <span>{result.message}</span>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <label className="form-control">
          <span className="label-text mb-1">SMTP Host</span>
          <input
            className="input input-bordered"
            value={form.smtpHost}
            onChange={(e) => updateField("smtpHost", e.target.value)}
            placeholder="smtp.gmail.com"
            required
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1">SMTP Port</span>
          <input
            className="input input-bordered"
            value={form.smtpPort}
            onChange={(e) => updateField("smtpPort", e.target.value)}
            placeholder="465"
            required
          />
        </label>

        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1">
            Use Secure Connection (SSL/TLS)
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={form.secure}
            onChange={(e) => updateField("secure", e.target.checked)}
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1">Sender Name</span>
          <input
            className="input input-bordered"
            value={form.senderName}
            onChange={(e) => updateField("senderName", e.target.value)}
            placeholder="RTC Notifications"
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1">Sender Email</span>
          <input
            className="input input-bordered"
            value={form.senderEmail}
            onChange={(e) => updateField("senderEmail", e.target.value)}
            placeholder="example@gmail.com"
            required
          />
        </label>

        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1">
            Sender Password / App Password
          </span>
          <div className="join w-full">
            <input
              type={showPassword ? "text" : "password"}
              className="input input-bordered join-item w-full"
              value={form.senderPassword}
              onChange={(e) => updateField("senderPassword", e.target.value)}
              required
            />
            <button
              type="button"
              className="btn btn-outline join-item"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </label>

        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1">Recipient(s)</span>
          <input
            className="input input-bordered"
            value={form.to}
            onChange={(e) => updateField("to", e.target.value)}
            placeholder="recipient@example.com or a@x.com,b@y.com"
            required
          />
        </label>

        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1">Subject</span>
          <input
            className="input input-bordered"
            value={form.subject}
            onChange={(e) => updateField("subject", e.target.value)}
          />
        </label>

        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1">Message</span>
          <textarea
            className="textarea textarea-bordered min-h-32"
            value={form.text}
            onChange={(e) => updateField("text", e.target.value)}
          />
        </label>

        <div className="lg:col-span-2 flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Sending..." : "Send Test Email"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={loading}
            onClick={() => {
              setForm(initialFormState);
              setResult(null);
            }}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
