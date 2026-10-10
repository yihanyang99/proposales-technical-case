import { NextResponse, type NextRequest } from "next/server";
import { authSecret, isValidSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Requires a signed session cookie (see app/login) on every page and server action. Without
 * APP_PASSWORD the app stays open in development and refuses all requests in production, so a
 * deployment is never public by mistake.
 */
export function proxy(request: NextRequest) {
  const secret = authSecret(process.env);
  if (!secret) {
    return process.env.NODE_ENV === "production"
      ? new NextResponse("Access is not configured. Set APP_PASSWORD on the server.", { status: 503 })
      : NextResponse.next();
  }
  if (request.nextUrl.pathname === "/login") return NextResponse.next();
  if (isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret, Date.now())) return NextResponse.next();

  // Server actions and other non-page requests get a plain refusal; pages go to the login.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Sign in required.", { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except build assets and the icon, so the login page renders fully.
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
