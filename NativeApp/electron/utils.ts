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

export const logError = (context: string, error: unknown): string => {
  if (error instanceof Error) {
    console.error(context, {
      message: error.message,
      stack: error.stack,
    });
  } else {
    console.error(context, error);
  }

  return formatError(error);
};
