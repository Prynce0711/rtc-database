"use server";
import nodemailer from "nodemailer";

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  try {
    // Create a transporter using the test account
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GOOGLE_EMAIL, // Your Gmail address
        pass: process.env.GOOGLE_APP_PASSWORD, // The 16-character App Password
      },
    });

    const info = await transporter.sendMail({
      from: '"Test Sender" <test@example.com>',
      to: to,
      subject: subject,
      text: text,
      html: `<p>${text}</p>`,
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
