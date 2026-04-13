"use server";

import { getSystemSettings } from "@/app/components/Settings/SettingsActions";
import { validateSession } from "@/app/lib/authActions";
import Roles from "@/app/lib/Roles";
import { ActionResult } from "@rtc-database/shared";
import nodemailer from "nodemailer";

export type EmailTesterPayload = {
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  senderName?: string;
  senderEmail: string;
  senderPassword: string;
  to: string;
  subject: string;
  text: string;
};

export type EmailTesterResult = {
  accepted: string[];
  rejected: string[];
  response: string;
};

export type GlobalSmtpSettings = {
  smtpHost: string;
  smtpPort: string;
  secure: boolean;
  senderName: string;
  senderEmail: string;
  senderPassword: string;
};

const normalizeEmailCsv = (value: string): string[] =>
  value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

const inferSecureByPort = (port: number | null): boolean => {
  if (!port) {
    return true;
  }

  if (port === 587) {
    return false;
  }

  return true;
};

const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function getGlobalSmtpSettings(): Promise<
  ActionResult<GlobalSmtpSettings>
> {
  try {
    const result = await getSystemSettings();
    if (!result.success) {
      return result;
    }

    const settings = result.result;
    return {
      success: true,
      result: {
        smtpHost: settings.smtpHost ?? "",
        smtpPort: settings.smtpPort ? String(settings.smtpPort) : "",
        secure: inferSecureByPort(settings.smtpPort),
        senderName: settings.senderName ?? "",
        senderEmail: settings.senderEmail ?? "",
        senderPassword: settings.senderPassword ?? "",
      },
    };
  } catch (error) {
    console.error("Error loading global SMTP settings:", error);
    return {
      success: false,
      error: "Failed to load global SMTP settings",
    };
  }
}

export async function sendEmailWithSmtp(
  payload: EmailTesterPayload,
): Promise<ActionResult<EmailTesterResult>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    if (
      !payload.smtpHost ||
      !payload.smtpPort ||
      !payload.senderEmail ||
      !payload.senderPassword ||
      !payload.to
    ) {
      return {
        success: false,
        error:
          "SMTP host, port, sender credentials, and recipient are required",
      };
    }

    const transporter = nodemailer.createTransport({
      host: payload.smtpHost,
      port: payload.smtpPort,
      secure: payload.secure,
      auth: {
        user: payload.senderEmail,
        pass: payload.senderPassword,
      },
    });

    await transporter.verify();

    const senderDisplayName = payload.senderName?.trim();
    const from = senderDisplayName
      ? `"${senderDisplayName}" <${payload.senderEmail}>`
      : payload.senderEmail;

    const info = await transporter.sendMail({
      from,
      to: normalizeEmailCsv(payload.to),
      subject: payload.subject || "SMTP Test Email",
      text: payload.text || "This is a test email.",
      html: `<p>${escapeHtml(payload.text || "This is a test email.").replace(/\n/g, "<br />")}</p>`,
    });

    return {
      success: true,
      result: {
        accepted: info.accepted.map(String),
        rejected: info.rejected.map(String),
        response: info.response,
      },
    };
  } catch (error) {
    console.error("Error sending email from tester:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send test email",
    };
  }
}
