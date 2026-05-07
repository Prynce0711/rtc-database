"use client";

import { FileUp, FolderUp } from "lucide-react";
import { ChangeEvent, InputHTMLAttributes, useRef } from "react";

interface UploadButtonsProps {
  onUpload: (files: File[]) => void;
  disabled?: boolean;
}

type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

const filesFromInput = (event: ChangeEvent<HTMLInputElement>): File[] => {
  const files = Array.from(event.target.files ?? []);
  event.target.value = "";
  return files;
};

const UploadButtons = ({ onUpload, disabled = false }: UploadButtonsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => onUpload(filesFromInput(event))}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => onUpload(filesFromInput(event))}
        {...({
          webkitdirectory: "",
          directory: "",
        } as DirectoryInputProps)}
      />

      <button
        type="button"
        className="btn btn-primary min-h-10 h-10 rounded-lg px-4"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUp size={17} aria-hidden="true" />
        Upload Files
      </button>
      <button
        type="button"
        className="btn btn-outline min-h-10 h-10 rounded-lg px-4"
        disabled={disabled}
        onClick={() => folderInputRef.current?.click()}
      >
        <FolderUp size={17} aria-hidden="true" />
        Upload Folders
      </button>
    </div>
  );
};

export default UploadButtons;
