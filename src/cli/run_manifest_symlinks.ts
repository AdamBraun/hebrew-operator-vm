import fs from "node:fs/promises";
import path from "node:path";

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`run manifest symlink: ${label} must be non-empty string`);
  }
}

async function replaceWithSymlink(linkPath: string, targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(linkPath), { recursive: true });
  try {
    const current = await fs.lstat(linkPath);
    if (current.isDirectory()) {
      throw new Error(`run manifest symlink: expected file link at ${linkPath}, found directory`);
    }
    await fs.unlink(linkPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }

  const relativeTarget = path.relative(path.dirname(linkPath), targetPath);
  await fs.symlink(
    relativeTarget.length > 0 ? relativeTarget : path.basename(targetPath),
    linkPath
  );
}

export async function writeRunManifestSymlinks(args: {
  outRoot: string;
  layer: string;
  digest: string;
  manifestPath: string;
}): Promise<{ runAliasPath: string; latestAliasPath: string }> {
  assertNonEmptyString(args.outRoot, "outRoot");
  assertNonEmptyString(args.layer, "layer");
  assertNonEmptyString(args.digest, "digest");
  assertNonEmptyString(args.manifestPath, "manifestPath");

  const outRoot = path.resolve(args.outRoot);
  const manifestPath = path.resolve(args.manifestPath);
  const runAliasPath = path.join(outRoot, "runs", args.digest, "manifests", `${args.layer}.json`);
  const latestAliasPath = path.join(outRoot, "runs", "latest", "manifests", `${args.layer}.json`);

  await replaceWithSymlink(runAliasPath, manifestPath);
  await replaceWithSymlink(latestAliasPath, manifestPath);

  return { runAliasPath, latestAliasPath };
}
