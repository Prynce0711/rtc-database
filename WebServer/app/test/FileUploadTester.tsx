"use client";

import { useEffect, useState } from "react";
import {
  deleteGarageFile,
  getGarageFileUrl,
  listGarageFiles,
  uploadFileToGarage,
} from "../lib/garageActions";

interface UploadResult {
  success: boolean;
  fileName?: string;
  error?: string;
}

interface GarageFile {
  key: string;
  size: number;
  lastModified: Date;
}

export default function FileUploadTester() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<GarageFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const loadFiles = async () => {
    setLoadingFiles(true);
    const result = await listGarageFiles();
    if (result.success && result.result) {
      setFiles(result.result);
    }
    setLoadingFiles(false);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const fileName = `${Date.now()}-${file.name}`;
      const uploadResult = await uploadFileToGarage(file, fileName);

      if (uploadResult.success) {
        setResult({ success: true, fileName: uploadResult.result });
        setFile(null);
        // Reload the file list
        await loadFiles();
      } else {
        setError(uploadResult.error || "Upload failed");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (key: string) => {
    try {
      const urlResult = await getGarageFileUrl(key);
      if (urlResult.success && urlResult.result) {
        // Open the signed URL to download/view the file
        console.log("File URL:", urlResult.result);
        window.open(urlResult.result, "_blank");
      } else {
        alert(
          urlResult.success === false
            ? urlResult.error || "Failed to get file URL"
            : "Failed to get file URL",
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download file");
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"?`)) {
      return;
    }

    try {
      const deleteResult = await deleteGarageFile(key);
      if (deleteResult.success) {
        // Reload the file list
        await loadFiles();
      } else {
        alert(
          deleteResult.success === false
            ? deleteResult.error || "Failed to delete file"
            : "Failed to delete file",
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete file");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">File Upload Tester</h1>

        {/* File Input Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* File Info */}
          {file && (
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">File:</span> {file.name}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Size:</span>{" "}
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
              text-white font-medium py-2 px-4 rounded-md transition-colors
              disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Success Result */}
      {result?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <p className="text-green-800 font-bold mb-4">Upload Successful!</p>
          <div className="bg-white p-4 rounded border border-green-200">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Stored as:</span> {result.fileName}
            </p>
          </div>
        </div>
      )}

      {/* Existing Files List */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Existing Files</h2>
          <button
            onClick={loadFiles}
            disabled={loadingFiles}
            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 
              text-white font-medium py-2 px-4 rounded-md transition-colors
              disabled:cursor-not-allowed text-sm"
          >
            {loadingFiles ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {files.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No files uploaded yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left p-3 font-semibold border">No.</th>
                  <th className="text-left p-3 font-semibold border">
                    File Name
                  </th>
                  <th className="text-left p-3 font-semibold border">Size</th>
                  <th className="text-left p-3 font-semibold border">
                    Last Modified
                  </th>
                  <th className="text-left p-3 font-semibold border">Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, idx) => (
                  <tr key={file.key} className="border-b hover:bg-gray-50">
                    <td className="p-3 border">{idx + 1}</td>
                    <td className="p-3 border font-mono text-xs">{file.key}</td>
                    <td className="p-3 border">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </td>
                    <td className="p-3 border">
                      {new Date(file.lastModified).toLocaleString()}
                    </td>
                    <td className="p-3 border">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(file.key)}
                          className="bg-blue-600 hover:bg-blue-700 text-white 
                            font-medium py-1 px-3 rounded text-xs transition-colors"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(file.key)}
                          className="bg-red-600 hover:bg-red-700 text-white 
                            font-medium py-1 px-3 rounded text-xs transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
