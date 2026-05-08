import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const isWindows = os.platform() === "win32";

if (isWindows) {
  // On Windows, fall back to Docker wrapper
  const dockerImage =
    process.env.ELECTRON_BUILDER_DOCKER_IMAGE ??
    "electronuserland/builder:latest";
  const buildCommand =
    process.env.ELECTRON_BUILDER_DOCKER_COMMAND ??
    "corepack enable && pnpm install --frozen-lockfile && cd NativeApp && pnpm build:linux";

  const mountSource = repoRoot.replace(/\\/g, "/");
  const dockerArgs = [
    "run",
    "--rm",
    "--mount",
    `type=bind,source=${mountSource},target=/project`,
    "--workdir",
    "/project",
    dockerImage,
    "sh",
    "-lc",
    buildCommand,
  ];

  const result = spawnSync("docker", dockerArgs, {
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      console.error(
        "Docker was not found on PATH. Install Docker Engine or Docker Desktop to build Linux artifacts on Windows.",
      );
    } else {
      console.error(
        "Failed to launch the Docker-based Linux build:",
        result.error.message,
      );
    }

    process.exit(1);
  }

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  process.exit(1);
} else {
  // On Linux/Mac, run the native build
  const result = spawnSync(
    "sh",
    ["-lc", "tsc && vite build && electron-builder --linux AppImage deb"],
    {
      stdio: "inherit",
      cwd: path.dirname(__dirname),
    },
  );

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  process.exit(1);
}
