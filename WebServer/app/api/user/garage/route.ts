import { validateSession } from "@/app/lib/authActions";
import { getGarageClient } from "@/app/lib/garage";
import { loadSystemSettings } from "@/app/lib/systemSettings";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

const sanitizeContentDispositionFileName = (
  fileName: string | null | undefined,
): string | undefined => {
  const normalized = String(fileName ?? "")
    .replace(/[\r\n"]/g, "")
    .trim();
  return normalized || undefined;
};

async function resolveSignedUrlFromRequest(
  searchParams: URLSearchParams,
): Promise<string | null> {
  const rawSignedUrl = searchParams.get("url")?.trim();
  if (rawSignedUrl) {
    return rawSignedUrl;
  }

  const bucket = searchParams.get("bucket")?.trim();
  const key = searchParams.get("key")?.trim();
  if (!bucket || !key) {
    return null;
  }

  const inline = searchParams.get("inline") === "1";
  const fileName =
    sanitizeContentDispositionFileName(searchParams.get("fileName")) ??
    key.split("/").pop() ??
    "file";
  const contentType =
    sanitizeContentDispositionFileName(searchParams.get("contentType")) ??
    undefined;
  const garageClient = await getGarageClient();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
    ...(contentType ? { ResponseContentType: contentType } : {}),
  });

  return getSignedUrl(garageClient, command, {
    expiresIn: 3600,
  });
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
    const resolvedSignedUrl = await resolveSignedUrlFromRequest(searchParams);
    if (!resolvedSignedUrl) {
      return Response.json(
        { error: "Missing file reference" },
        { status: 400 },
      );
    }

    const settings = await loadSystemSettings();
    const allowedOrigin = getGarageOrigin(settings);
    const signedUrl = new URL(resolvedSignedUrl);

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
