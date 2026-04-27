import { validateSession } from "@/app/lib/authActions";
import { loadSystemSettings } from "@/app/lib/systemSettings";

export const runtime = "nodejs";

function getGarageOrigin(settings: {
  garageHost: string | null;
  garagePort: number | null;
  garageIsHttps: boolean;
}): string {
  const protocol = settings.garageIsHttps ? "https" : "http";
  const host = settings.garageHost?.trim();
  const port = settings.garagePort;

  if (!host || !port) {
    throw new Error("Garage configuration is incomplete.");
  }

  return `${protocol}://${host}:${port}`;
}

export async function GET(request: Request) {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return Response.json(
        { error: sessionResult.error || "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const rawSignedUrl = searchParams.get("url")?.trim();
    if (!rawSignedUrl) {
      return Response.json({ error: "Missing signed url" }, { status: 400 });
    }

    const settings = await loadSystemSettings();
    const allowedOrigin = getGarageOrigin(settings);
    const signedUrl = new URL(rawSignedUrl);

    if (!["http:", "https:"].includes(signedUrl.protocol)) {
      return Response.json(
        { error: "Invalid signed url protocol" },
        { status: 400 },
      );
    }

    if (signedUrl.origin !== allowedOrigin) {
      return Response.json(
        { error: "Signed url origin is not allowed" },
        { status: 403 },
      );
    }

    const upstream = await fetch(signedUrl, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: "Failed to fetch file" },
        { status: upstream.status || 502 },
      );
    }

    const headers = new Headers();
    headers.set("Cache-Control", "private, no-store");

    for (const headerName of [
      "content-type",
      "content-length",
      "content-disposition",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("Garage proxy GET error:", error);
    return Response.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
