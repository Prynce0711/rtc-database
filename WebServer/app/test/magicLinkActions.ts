"use server";

import { auth } from "@/app/lib/auth";
import { headers } from "next/headers";

export async function sendMagicLink(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await auth.api.signInMagicLink({
      body: { email },
      headers: await headers(),
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || "Failed to send magic link",
    };
  }
}
