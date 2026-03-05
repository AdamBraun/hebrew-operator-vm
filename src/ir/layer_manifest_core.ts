import { execFileSync } from "node:child_process";

export const LAYER_MANIFEST_CORE_VERSION = "1.0.0";

export type LayerManifestCoreInputDigests = {
  spineDigest: string | null;
  datasetDigest: string | null;
  configDigest: string | null;
};

export type LayerManifestCoreStats = {
  record_count: number;
  gcount: number;
  gapcount: number;
  event_counts: Record<string, number>;
};

export type LayerManifestCoreBuild = {
  git_sha: string | null;
  timestamp: string;
};

export type LayerManifestCore = {
  schema_version: typeof LAYER_MANIFEST_CORE_VERSION;
  layer_name: string;
  layer_semver: string;
  input_digests: LayerManifestCoreInputDigests;
  output_digest: string;
  ir_schema_version: string;
  stats: LayerManifestCoreStats;
  build: LayerManifestCoreBuild;
};

const SHORT_GIT_SHA_HEX = /^[a-f0-9]{7,40}$/;

export function detectGitSha(): string | null {
  const envCandidates = [
    process.env.GITHUB_SHA,
    process.env.GIT_SHA,
    process.env.BUILD_GIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA
  ];
  for (const candidate of envCandidates) {
    const normalized = typeof candidate === "string" ? candidate.trim().toLowerCase() : "";
    if (SHORT_GIT_SHA_HEX.test(normalized)) {
      return normalized;
    }
  }

  try {
    const gitSha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    })
      .trim()
      .toLowerCase();
    if (SHORT_GIT_SHA_HEX.test(gitSha)) {
      return gitSha;
    }
  } catch {
    // Non-git context or git unavailable.
  }

  return null;
}

function normalizeNonNegativeInteger(value: number): number {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function createLayerManifestCore(args: {
  layer_name: string;
  layer_semver: string;
  input_digests: LayerManifestCoreInputDigests;
  output_digest: string;
  ir_schema_version: string;
  stats: LayerManifestCoreStats;
  timestamp: string;
}): LayerManifestCore {
  const eventCounts: Record<string, number> = {};
  for (const key of Object.keys(args.stats.event_counts).sort()) {
    eventCounts[key] = normalizeNonNegativeInteger(args.stats.event_counts[key] ?? 0);
  }
  return {
    schema_version: LAYER_MANIFEST_CORE_VERSION,
    layer_name: args.layer_name,
    layer_semver: args.layer_semver,
    input_digests: {
      spineDigest: args.input_digests.spineDigest,
      datasetDigest: args.input_digests.datasetDigest,
      configDigest: args.input_digests.configDigest
    },
    output_digest: args.output_digest,
    ir_schema_version: args.ir_schema_version,
    stats: {
      record_count: normalizeNonNegativeInteger(args.stats.record_count),
      gcount: normalizeNonNegativeInteger(args.stats.gcount),
      gapcount: normalizeNonNegativeInteger(args.stats.gapcount),
      event_counts: eventCounts
    },
    build: {
      git_sha: detectGitSha(),
      timestamp: args.timestamp
    }
  };
}
