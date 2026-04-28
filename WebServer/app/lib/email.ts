"use server";

import nodemailer from "nodemailer";
import { loadSystemSettings } from "@/app/lib/systemSettings";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  try {
    const systemSettings = await loadSystemSettings();

    if (
      !systemSettings.smtpHost ||
      !systemSettings.smtpPort ||
      !systemSettings.senderEmail ||
      !systemSettings.senderName ||
      !systemSettings.senderPassword
    ) {
      console.error("Incomplete SMTP settings");
      return false;
    }

    // Create a transporter using the test account
    const transporter = nodemailer.createTransport({
      host: systemSettings.smtpHost,
      port: systemSettings.smtpPort,
      secure: true,
      auth: {
        user: systemSettings.senderEmail, // Your Gmail address
        pass: systemSettings.senderPassword, // The 16-character App Password
      },
    });

    const info = await transporter.sendMail({
      from: `"${systemSettings.senderName}" <${systemSettings.senderEmail}>`,
      to: to,
      subject: subject,
      text: text,
      html: `<p>${escapeHtml(text).replace(/\n/g, "<br />")}</p>`,
    });

    if (info.accepted.length > 0) {
      console.log(
        "Email sent successfully! Preview URL:",
        nodemailer.getTestMessageUrl(info),
      );
      return true;
    } else {
      console.error("Email failed to send:", info);
      return false;
    }
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}
