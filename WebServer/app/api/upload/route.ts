import { validateSession } from "@/app/lib/authActions";
import { createReadStream, createWriteStream } from "fs";
import {
  access,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "fs/promises";
import path from "path";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GARAGE_ROOT = path.resolve(
  process.env.GARAGE_ROOT ?? path.join(path.sep, "garage"),
);
const CHUNK_ROOT = path.join(GARAGE_ROOT, ".chunks");
const GARAGE_PUBLIC_PREFIX = "/garage";

type UploadStatus = "completed" | "chunk-uploaded" | "failed" | "moved";

interface UploadResult {
  filename: string;
  path: string;
  relativePath: string;
  size?: number;
  status: UploadStatus;
}

interface GarageEntry {
  name: string;
  path: string;
  relativePath: string;
  type: "file" | "folder";
  size: number;
  modifiedAt: string;
  mimeType?: string;
}

const mimeTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

const getMimeType = (fileName: string): string =>
  mimeTypes[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";

const toPublicPath = (relativePath: string): string =>
  relativePath ? `${GARAGE_PUBLIC_PREFIX}/${relativePath}` : GARAGE_PUBLIC_PREFIX;

const normalizeSlashes = (value: string): string => value.replace(/\\/g, "/");

const sanitizeSegment = (segment: string): string => {
  const sanitized = segment
    .replace(/[\u0000-\u001f<>:"|?*]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();

  return sanitized || "_";
};

const normalizeGaragePath = (rawPath: string | null | undefined): string => {
  const withoutPrefix = normalizeSlashes(String(rawPath ?? ""))
    .trim()
    .replace(/^\/?garage\/?/i, "");

  if (!withoutPrefix) {
    return "";
  }

  const segments = withoutPrefix
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (segment === "." || segment === "..") {
        throw new Error("Path traversal is not allowed.");
      }

      return sanitizeSegment(segment);
    });

  return segments.join("/");
};

const resolveGaragePath = (rawPath: string | null | undefined) => {
  const relativePath = normalizeGaragePath(rawPath);
  const absolutePath = path.resolve(GARAGE_ROOT, relativePath);
  const relativeFromRoot = path.relative(GARAGE_ROOT, absolutePath);

  if (relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    throw new Error("Resolved path escaped the garage root.");
  }

  return { absolutePath, relativePath };
};

const parseNumberField = (
  formData: FormData,
  field: string,
  fallback?: number,
): number => {
  const value = Number(formData.get(field));
  if (!Number.isFinite(value)) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`Invalid ${field}`);
  }

  return value;
};

const isUploadedFile = (value: FormDataEntryValue | null): value is File =>
  typeof value === "object" &&
  value !== null &&
  "arrayBuffer" in value &&
  "name" in value;

const fileExists = async (absolutePath: string): Promise<boolean> => {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
};

async function requireAuthenticatedRequest() {
  const sessionResult = await validateSession();

  if (!sessionResult.success) {
    return Response.json(
      { error: sessionResult.error || "Unauthorized" },
      { status: 401 },
    );
  }

  await mkdir(GARAGE_ROOT, { recursive: true });
  return null;
}

async function saveFile(file: File, rawRelativePath: string): Promise<UploadResult> {
  const relativePath = normalizeGaragePath(rawRelativePath || file.name);
  if (!relativePath) {
    throw new Error("Missing destination path.");
  }

  const { absolutePath } = resolveGaragePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    filename: path.basename(relativePath),
    path: toPublicPath(relativePath),
    relativePath,
    size: file.size,
    status: "completed",
  };
}

async function appendChunks(
  chunkDirectory: string,
  destinationPath: string,
  totalChunks: number,
) {
  await mkdir(path.dirname(destinationPath), { recursive: true });

  const temporaryPath = `${destinationPath}.uploading`;
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(temporaryPath, { flags: "w" });
    let index = 0;

    const pipeNextChunk = () => {
      if (index >= totalChunks) {
        output.end();
        return;
      }

      const input = createReadStream(path.join(chunkDirectory, `${index}.part`));
      input.on("error", reject);
      input.on("end", () => {
        index += 1;
        pipeNextChunk();
      });
      input.pipe(output, { end: false });
    };

    output.on("finish", resolve);
    output.on("error", reject);
    pipeNextChunk();
  });

  await rename(temporaryPath, destinationPath);
}

async function handleChunkUpload(formData: FormData): Promise<Response> {
  const chunk = formData.get("chunk");
  if (!isUploadedFile(chunk)) {
    return Response.json({ error: "Missing chunk file." }, { status: 400 });
  }

  const uploadId = String(formData.get("uploadId") ?? "")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 160);
  const relativePath = normalizeGaragePath(String(formData.get("relativePath") ?? ""));
  const chunkIndex = parseNumberField(formData, "chunkIndex");
  const totalChunks = parseNumberField(formData, "totalChunks");
  const declaredFileSize = parseNumberField(formData, "fileSize", chunk.size);

  if (!uploadId || !relativePath || totalChunks < 1 || chunkIndex < 0) {
    return Response.json({ error: "Invalid chunk metadata." }, { status: 400 });
  }

  if (chunkIndex >= totalChunks) {
    return Response.json({ error: "Chunk index is out of range." }, { status: 400 });
  }

  const chunkDirectory = path.join(CHUNK_ROOT, uploadId);
  await mkdir(chunkDirectory, { recursive: true });
  await writeFile(
    path.join(chunkDirectory, `${chunkIndex}.part`),
    Buffer.from(await chunk.arrayBuffer()),
  );

  const allChunksPresent = await Promise.all(
    Array.from({ length: totalChunks }, (_, index) =>
      fileExists(path.join(chunkDirectory, `${index}.part`)),
    ),
  );

  if (!allChunksPresent.every(Boolean)) {
    return Response.json({
      filename: path.basename(relativePath),
      path: toPublicPath(relativePath),
      relativePath,
      status: "chunk-uploaded" satisfies UploadStatus,
      chunkIndex,
      totalChunks,
    });
  }

  const { absolutePath } = resolveGaragePath(relativePath);
  await appendChunks(chunkDirectory, absolutePath, totalChunks);
  await rm(chunkDirectory, { recursive: true, force: true });

  return Response.json({
    file: {
      filename: path.basename(relativePath),
      path: toPublicPath(relativePath),
      relativePath,
      size: declaredFileSize,
      status: "completed",
    } satisfies UploadResult,
  });
}

async function listDirectory(rawPath: string | null): Promise<Response> {
  const { absolutePath, relativePath } = resolveGaragePath(rawPath);
  await mkdir(absolutePath, { recursive: true });

  const entries = await readdir(absolutePath, { withFileTypes: true });
  const result: GarageEntry[] = await Promise.all(
    entries
      .filter((entry) => entry.name !== ".chunks")
      .map(async (entry) => {
        const entryAbsolutePath = path.join(absolutePath, entry.name);
        const entryRelativePath = normalizeSlashes(
          path.posix.join(relativePath, entry.name),
        );
        const entryStat = await stat(entryAbsolutePath);
        const isDirectory = entry.isDirectory();

        return {
          name: entry.name,
          path: toPublicPath(entryRelativePath),
          relativePath: entryRelativePath,
          type: isDirectory ? "folder" : "file",
          size: isDirectory ? 0 : entryStat.size,
          modifiedAt: entryStat.mtime.toISOString(),
          mimeType: isDirectory ? undefined : getMimeType(entry.name),
        };
      }),
  );

  result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }

    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  return Response.json({
    root: GARAGE_PUBLIC_PREFIX,
    storageRoot: GARAGE_ROOT,
    path: toPublicPath(relativePath),
    relativePath,
    entries: result,
  });
}

async function downloadFile(
  rawPath: string | null,
  inline: boolean,
): Promise<Response> {
  const { absolutePath, relativePath } = resolveGaragePath(rawPath);
  const fileStat = await stat(absolutePath);

  if (!fileStat.isFile()) {
    return Response.json({ error: "Requested path is not a file." }, { status: 400 });
  }

  const filename = path.basename(relativePath);
  const asciiFilename = filename.replace(/[\r\n"]/g, "_");
  const headers = new Headers({
    "Cache-Control": "private, max-age=60",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Content-Length": String(fileStat.size),
    "Content-Type": getMimeType(filename),
  });

  return new Response(
    Readable.toWeb(createReadStream(absolutePath)) as unknown as BodyInit,
    {
    headers,
    },
  );
}

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedRequest();
    if (unauthorized) {
      return unauthorized;
    }

    const { searchParams } = new URL(request.url);
    const downloadPath = searchParams.get("download");

    if (downloadPath !== null) {
      return downloadFile(downloadPath, searchParams.get("inline") === "1");
    }

    return listDirectory(searchParams.get("path"));
  } catch (error) {
    console.error("Garage GET error:", error);
    return Response.json({ error: "Unable to read garage." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedRequest();
    if (unauthorized) {
      return unauthorized;
    }

    const formData = await request.formData();
    if (formData.has("chunk")) {
      return handleChunkUpload(formData);
    }

    const files = formData.getAll("files").filter(isUploadedFile);
    const relativePathsRaw = formData.get("relativePaths");
    const relativePaths =
      typeof relativePathsRaw === "string"
        ? (JSON.parse(relativePathsRaw) as string[])
        : formData.getAll("relativePath").map(String);

    if (!files.length) {
      return Response.json({ error: "No files received." }, { status: 400 });
    }

    const results = await Promise.all(
      files.map((file, index) =>
        saveFile(file, relativePaths[index] || file.name),
      ),
    );

    return Response.json({ files: results });
  } catch (error) {
    console.error("Garage POST error:", error);
    return Response.json({ error: "Upload failed." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedRequest();
    if (unauthorized) {
      return unauthorized;
    }

    const body = (await request.json()) as {
      sourcePath?: string;
      destinationDirectory?: string;
      destinationPath?: string;
    };

    const source = resolveGaragePath(body.sourcePath);
    const sourceStat = await stat(source.absolutePath);
    const destinationRelativePath = body.destinationPath
      ? normalizeGaragePath(body.destinationPath)
      : path.posix.join(
          normalizeGaragePath(body.destinationDirectory),
          path.posix.basename(source.relativePath),
        );
    const destination = resolveGaragePath(destinationRelativePath);

    if (source.absolutePath === destination.absolutePath) {
      return Response.json({
        filename: path.basename(destination.relativePath),
        path: toPublicPath(destination.relativePath),
        relativePath: destination.relativePath,
        status: "moved",
      } satisfies UploadResult);
    }

    if (
      sourceStat.isDirectory() &&
      path.relative(source.absolutePath, destination.absolutePath).startsWith("..") === false
    ) {
      return Response.json(
        { error: "A folder cannot be moved inside itself." },
        { status: 400 },
      );
    }

    if (await fileExists(destination.absolutePath)) {
      return Response.json(
        { error: "A file or folder already exists at the destination." },
        { status: 409 },
      );
    }

    await mkdir(path.dirname(destination.absolutePath), { recursive: true });
    await rename(source.absolutePath, destination.absolutePath);

    return Response.json({
      filename: path.basename(destination.relativePath),
      path: toPublicPath(destination.relativePath),
      relativePath: destination.relativePath,
      status: "moved",
    } satisfies UploadResult);
  } catch (error) {
    console.error("Garage PATCH error:", error);
    return Response.json({ error: "Move failed." }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET,POST,PATCH,OPTIONS",
    },
  });
}
