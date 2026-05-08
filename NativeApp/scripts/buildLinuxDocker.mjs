import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

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
      "Docker was not found on PATH. Install Docker Engine or Docker Desktop, then run pnpm build:linux:docker again.",
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
