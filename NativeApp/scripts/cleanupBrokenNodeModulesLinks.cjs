const fs = require("node:fs");
const path = require("node:path");

const candidateNodeModulesDirs = [
  path.resolve(__dirname, "..", "node_modules"),
  path.resolve(__dirname, "..", "..", "packages", "shared", "node_modules"),
];

function isBrokenSymlink(entryPath) {
  let stats;

  try {
    stats = fs.lstatSync(entryPath);
  } catch {
    return false;
  }

  if (!stats.isSymbolicLink()) {
    return false;
  }

  try {
    fs.realpathSync.native(entryPath);
    return false;
  } catch (error) {
    return (
      error?.code === "ENOENT" ||
      error?.code === "EINVAL" ||
      error?.code === "UNKNOWN"
    );
  }
}

function cleanupBrokenLinks(nodeModulesDir) {
  if (!fs.existsSync(nodeModulesDir)) {
    return 0;
  }

  let removedCount = 0;

  for (const entry of fs.readdirSync(nodeModulesDir, { withFileTypes: true })) {
    const entryPath = path.join(nodeModulesDir, entry.name);

    if (!isBrokenSymlink(entryPath)) {
      continue;
    }

    fs.rmSync(entryPath, { recursive: true, force: true });
    removedCount += 1;
    console.log(`[cleanup-links] removed broken link: ${entryPath}`);
  }

  return removedCount;
}

let totalRemoved = 0;

for (const nodeModulesDir of candidateNodeModulesDirs) {
  totalRemoved += cleanupBrokenLinks(nodeModulesDir);
}

if (totalRemoved > 0) {
  console.log(
    `[cleanup-links] removed ${totalRemoved} broken link(s) before electron-rebuild`,
  );
}
