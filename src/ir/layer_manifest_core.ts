import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

export const LAYER_MANIFEST_CORE_VERSION = "1.0.0";
export const LAYER_MANIFEST_ROLLING_CHUNK_SIZE = 50_000;

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

export type LayerManifestCoreOrdering = {
  first_anchor: string | null;
  last_anchor: string | null;
  anchor_hash: string;
  rolling_anchor_hash: {
    chunk_size: number;
    chunk_digests: string[];
  };
};

export type LayerManifestCore = {
  schema_version: typeof LAYER_MANIFEST_CORE_VERSION;
  layer_name: string;
  layer_semver: string;
  input_digests: LayerManifestCoreInputDigests;
  output_digest: string;
  ir_schema_version: string;
  stats: LayerManifestCoreStats;
  ordering: LayerManifestCoreOrdering;
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

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export class LayerAnchorOrderingAccumulator {
  private readonly anchorHash = crypto.createHash("sha256");
  private readonly chunkDigests: string[] = [];
  private chunkHash = crypto.createHash("sha256");
  private chunkCount = 0;
  private firstAnchor: string | null = null;
  private lastAnchor: string | null = null;
  private readonly chunkSize: number;

  constructor(chunkSize = LAYER_MANIFEST_ROLLING_CHUNK_SIZE) {
    if (!Number.isInteger(chunkSize) || chunkSize < 1) {
      throw new Error("layer manifest core: chunkSize must be integer >= 1");
    }
    this.chunkSize = chunkSize;
  }

  push(anchor: string): void {
    if (typeof anchor !== "string" || anchor.length === 0) {
      throw new Error("layer manifest core: anchor must be non-empty string");
    }
    if (this.firstAnchor === null) {
      this.firstAnchor = anchor;
    }
    this.lastAnchor = anchor;

    this.anchorHash.update(anchor);
    this.anchorHash.update("\n");
    this.chunkHash.update(anchor);
    this.chunkHash.update("\n");
    this.chunkCount += 1;

    if (this.chunkCount >= this.chunkSize) {
      this.chunkDigests.push(this.chunkHash.digest("hex"));
      this.chunkHash = crypto.createHash("sha256");
      this.chunkCount = 0;
    }
  }

  finalize(): LayerManifestCoreOrdering {
    if (this.chunkCount > 0) {
      this.chunkDigests.push(this.chunkHash.digest("hex"));
      this.chunkHash = crypto.createHash("sha256");
      this.chunkCount = 0;
    }
    return {
      first_anchor: this.firstAnchor,
      last_anchor: this.lastAnchor,
      anchor_hash: this.anchorHash.digest("hex"),
      rolling_anchor_hash: {
        chunk_size: this.chunkSize,
        chunk_digests: [...this.chunkDigests]
      }
    };
  }
}

function normalizeOrdering(
  ordering: LayerManifestCoreOrdering | undefined
): LayerManifestCoreOrdering {
  if (!ordering) {
    return {
      first_anchor: null,
      last_anchor: null,
      anchor_hash: sha256Hex(""),
      rolling_anchor_hash: {
        chunk_size: LAYER_MANIFEST_ROLLING_CHUNK_SIZE,
        chunk_digests: []
      }
    };
  }

  return {
    first_anchor: ordering.first_anchor ?? null,
    last_anchor: ordering.last_anchor ?? null,
    anchor_hash: ordering.anchor_hash,
    rolling_anchor_hash: {
      chunk_size:
        Number.isInteger(ordering.rolling_anchor_hash.chunk_size) &&
        ordering.rolling_anchor_hash.chunk_size >= 1
          ? ordering.rolling_anchor_hash.chunk_size
          : LAYER_MANIFEST_ROLLING_CHUNK_SIZE,
      chunk_digests: [...ordering.rolling_anchor_hash.chunk_digests]
    }
  };
}

export function createLayerManifestCore(args: {
  layer_name: string;
  layer_semver: string;
  input_digests: LayerManifestCoreInputDigests;
  output_digest: string;
  ir_schema_version: string;
  stats: LayerManifestCoreStats;
  ordering?: LayerManifestCoreOrdering;
  timestamp: string;
}): LayerManifestCore {
  const eventCounts: Record<string, number> = {};
  for (const key of Object.keys(args.stats.event_counts).sort()) {
    eventCounts[key] = normalizeNonNegativeInteger(args.stats.event_counts[key] ?? 0);
  }
  const ordering = normalizeOrdering(args.ordering);
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
    ordering,
    build: {
      git_sha: detectGitSha(),
      timestamp: args.timestamp
    }
  };
}
