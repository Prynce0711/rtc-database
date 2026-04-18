import path from "path";

export const resolveSafePath = (baseFolder: string, relativePath: string) => {
  const normalizedBase = path.resolve(baseFolder);
  const safeRelative = relativePath.replace(/^[\\/]+/, "");
  const fullPath = path.resolve(normalizedBase, safeRelative);

  if (
    fullPath !== normalizedBase &&
    !fullPath.startsWith(`${normalizedBase}${path.sep}`)
  ) {
    return null;
  }

  return fullPath;
};

export const formatError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
};
