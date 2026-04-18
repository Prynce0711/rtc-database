export const IPC_CHANNELS = {
  FILES_SELECT_BASE_FOLDER: "files:select-base-folder",
  FILES_CHECK_EXISTS: "files:check-exists",
  FILES_READ: "files:read",
  RCLONE_AUTHORIZE_PROVIDER: "rclone:authorize-provider",
  SESSION_SYNC_USER_MINIMAL: "session:sync-user-minimal",
  SESSION_GET_DEVICE_ID: "session:get-device-id",
  UPSERT_SINGLE_CRIMINAL_CASE: "sync:criminal:upsert-single",
} as const;
