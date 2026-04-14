import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./lib/auth";

const allowedOrigins = new Set([
  process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
  process.env.NATIVE_APP_URL || "http://localhost:5173",
]);

function applyCorsHeaders(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin") || "";
  const allowOrigin = allowedOrigins.has(origin)
    ? origin
    : process.env.NATIVE_APP_URL || "http://localhost:5173";

  const requestedHeaders =
    request.headers.get("access-control-request-headers") || "Content-Type";

  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  response.headers.set("Access-Control-Allow-Headers", requestedHeaders);
  response.headers.set("Vary", "Origin, Access-Control-Request-Headers");
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 });
      applyCorsHeaders(request, response);
      return response;
    }

    const response = NextResponse.next();
    applyCorsHeaders(request, response);
    return response;
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/user/:path*", "/api/:path*"],
};
