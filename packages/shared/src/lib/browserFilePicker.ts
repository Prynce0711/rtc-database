type FileHandleLike = {
  kind?: "file";
  name: string;
  getFile: () => Promise<File>;
};

type DirectoryHandleLike = {
  kind?: "directory";
  name: string;
  values?: () => AsyncIterable<FileHandleLike | DirectoryHandleLike>;
  entries?: () => AsyncIterable<[string, FileHandleLike | DirectoryHandleLike]>;
};

type BrowserPickerWindow = Window &
  typeof globalThis & {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      excludeAcceptAllOption?: boolean;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileHandleLike[]>;
    showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
  };

const getPickerWindow = (): BrowserPickerWindow | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window as BrowserPickerWindow;
};

export const getFileRelativePath = (file: File): string => {
  const fileWithPath = file as File & { webkitRelativePath?: string };
  return fileWithPath.webkitRelativePath || file.name;
};

const normalizeRelativePath = (value: string): string =>
  value
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");

const withRelativePath = (file: File, relativePath: string): File => {
  const clonedFile = new File([file], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });

  Object.defineProperty(clonedFile, "webkitRelativePath", {
    configurable: true,
    enumerable: false,
    value: normalizeRelativePath(relativePath),
  });

  return clonedFile;
};

const readDirectoryHandles = async (
  directoryHandle: DirectoryHandleLike,
): Promise<Array<FileHandleLike | DirectoryHandleLike>> => {
  if (directoryHandle.values) {
    const values: Array<FileHandleLike | DirectoryHandleLike> = [];

    for await (const value of directoryHandle.values()) {
      values.push(value);
    }

    return values;
  }

  if (directoryHandle.entries) {
    const values: Array<FileHandleLike | DirectoryHandleLike> = [];

    for await (const [, value] of directoryHandle.entries()) {
      values.push(value);
    }

    return values;
  }

  return [];
};

const walkDirectoryHandle = async (
  directoryHandle: DirectoryHandleLike,
  prefix: string,
): Promise<File[]> => {
  const entries = await readDirectoryHandles(directoryHandle);
  const files = await Promise.all(
    entries.map(async (entry) => {
      if (entry.kind === "directory" || "values" in entry || "entries" in entry) {
        return walkDirectoryHandle(
          entry as DirectoryHandleLike,
          normalizeRelativePath(`${prefix}/${entry.name}`),
        );
      }

      const file = await (entry as FileHandleLike).getFile();
      return [withRelativePath(file, `${prefix}/${file.name}`)];
    }),
  );

  return files.flat();
};

export const pickFilesWithFileSystemAccess = async (): Promise<File[] | null> => {
  const pickerWindow = getPickerWindow();
  if (!pickerWindow?.showOpenFilePicker) {
    return null;
  }

  const handles = await pickerWindow.showOpenFilePicker({
    multiple: true,
  });

  return Promise.all(handles.map((handle) => handle.getFile()));
};

export const pickDirectoriesWithFileSystemAccess = async (options?: {
  allowMultiple?: boolean;
  confirmAnother?: () => boolean;
}): Promise<File[] | null> => {
  const pickerWindow = getPickerWindow();
  if (!pickerWindow?.showDirectoryPicker) {
    return null;
  }

  const allowMultiple = options?.allowMultiple ?? true;
  const confirmAnother =
    options?.confirmAnother ??
    (() => window.confirm("Select another folder for this upload?"));
  const selectedFiles: File[] = [];

  while (true) {
    let directoryHandle: DirectoryHandleLike;

    try {
      directoryHandle = await pickerWindow.showDirectoryPicker();
    } catch {
      break;
    }

    selectedFiles.push(
      ...(await walkDirectoryHandle(directoryHandle, directoryHandle.name)),
    );

    if (!allowMultiple || !confirmAnother()) {
      break;
    }
  }

  return selectedFiles;
};
