"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authSecret, createSessionToken, passwordMatches, safeNextPath, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";

export type SignInState = { error: string | null };

/** Checks the shared password and sets the signed session cookie. */
export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const next = safeNextPath(formData.get("next"));
  const secret = authSecret(process.env);
  if (!secret) redirect(next); // Development without a password: nothing to sign in to.

  const password = formData.get("password");
  if (typeof password !== "string" || !passwordMatches(password, secret)) {
    // A short pause makes guessing slow.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: "That password isn't right. Check the one you received and try again." };
  }

  (await cookies()).set(SESSION_COOKIE, createSessionToken(secret, Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect(next);
}
