declare module "rclone.js" {
  type FlagValue = string | number | boolean | null | undefined;
  type Flags = Record<string, FlagValue | FlagValue[]>;

  type RclonePromiseApi = ((
    ...args: Array<string | number | boolean | Flags>
  ) => Promise<Buffer>) & {
    [command: string]: (
      ...args: Array<string | number | boolean | Flags>
    ) => Promise<Buffer>;
  };

  interface RcloneApi {
    (
      ...args: Array<string | number | boolean | Flags>
    ): import("child_process").ChildProcess;
    promises: RclonePromiseApi;
    [command: string]: unknown;
  }

  const rclone: RcloneApi;
  export default rclone;
}
