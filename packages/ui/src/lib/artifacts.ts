import type { ZodTypeAny } from 'zod';
import {
  formatZodIssue,
  poeticParaphraseRecordSchema,
  strictParaphraseRecordSchema,
  uiDataManifestSchema,
  type ManifestArtifact,
  type ManifestArtifactKind,
  type UiDataManifest,
  versePhraseTreeRecordSchema,
  wordPhraseRoleRecordSchema,
  wordTraceRecordSchema
} from './contracts';
import {
  evaluateVersionContract,
  formatVersionStatus,
  hasBlockingVersionIssue,
  type VersionStatus
} from './contracts/versioning';

const MANIFEST_PATH = '/data/manifest.json';

const artifactRecordSchemaByKind: Record<ManifestArtifactKind, ZodTypeAny> = {
  word_traces: wordTraceRecordSchema,
  verse_phrase_trees: versePhraseTreeRecordSchema,
  word_phrase_roles: wordPhraseRoleRecordSchema,
  render_strict_paraphrase: strictParaphraseRecordSchema,
  render_poetic_paraphrase: poeticParaphraseRecordSchema
};

export interface ValidatedArtifactSummary {
  kind: ManifestArtifactKind;
  path: string;
  records: number;
  sha256: string;
}

export interface ValidatedDataset {
  manifest: UiDataManifest;
  artifactSummaries: ValidatedArtifactSummary[];
  versionStatuses: VersionStatus[];
}

function resolveArtifactPath(path: string): string {
  if (path.startsWith('/')) {
    return path;
  }
  return `/data/${path.replace(/^\/+/, '')}`;
}

function renderContractError(path: string, detail: string): string {
  return `Data contract violation in ${path}: ${detail}`;
}

async function readText(path: string, fetcher: typeof fetch): Promise<string> {
  const response = await fetcher(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status})`);
  }
  return response.text();
}

function parseJsonlLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function hashSha256Hex(content: string): Promise<string | null> {
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    return null;
  }

  const bytes = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function utf8Bytes(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

function validateJsonlArtifact(artifact: ManifestArtifact, content: string): number {
  const schema = artifactRecordSchemaByKind[artifact.kind];
  const lines = parseJsonlLines(content);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(
        renderContractError(
          resolveArtifactPath(artifact.path),
          `line ${lineNumber} is invalid JSON (${String(error)})`
        )
      );
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        renderContractError(
          resolveArtifactPath(artifact.path),
          `line ${lineNumber} failed schema validation: ${formatZodIssue(result.error)}`
        )
      );
    }
  }

  return lines.length;
}

async function validateArtifact(
  artifact: ManifestArtifact,
  fetcher: typeof fetch
): Promise<ValidatedArtifactSummary> {
  const artifactPath = resolveArtifactPath(artifact.path);
  const content = await readText(artifactPath, fetcher);

  const records = validateJsonlArtifact(artifact, content);
  if (artifact.rows !== undefined && records !== artifact.rows) {
    throw new Error(
      renderContractError(
        artifactPath,
        `expected ${artifact.rows} rows from manifest but found ${records}`
      )
    );
  }

  if (artifact.bytes !== undefined) {
    const actualBytes = utf8Bytes(content);
    if (actualBytes !== artifact.bytes) {
      throw new Error(
        renderContractError(
          artifactPath,
          `expected ${artifact.bytes} bytes from manifest but found ${actualBytes}`
        )
      );
    }
  }

  const checksum = await hashSha256Hex(content);
  if (checksum && checksum !== artifact.sha256) {
    throw new Error(
      renderContractError(
        artifactPath,
        `expected checksum ${artifact.sha256} but found ${checksum}`
      )
    );
  }

  return {
    kind: artifact.kind,
    path: artifact.path,
    records,
    sha256: artifact.sha256
  };
}

export const readManifest = async (
  fetcher: typeof fetch = fetch
): Promise<UiDataManifest> => {
  const rawManifest = await readText(MANIFEST_PATH, fetcher);

  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(rawManifest);
  } catch (error) {
    throw new Error(renderContractError(MANIFEST_PATH, `Invalid JSON (${String(error)})`));
  }

  const result = uiDataManifestSchema.safeParse(parsedManifest);
  if (!result.success) {
    throw new Error(
      renderContractError(MANIFEST_PATH, `Schema validation failed: ${formatZodIssue(result.error)}`)
    );
  }

  return result.data;
};

export const readValidatedDataset = async (
  fetcher: typeof fetch = fetch
): Promise<ValidatedDataset> => {
  const manifest = await readManifest(fetcher);
  const versionStatuses = evaluateVersionContract(manifest.version_contract);

  if (hasBlockingVersionIssue(versionStatuses)) {
    throw new Error(
      renderContractError(
        MANIFEST_PATH,
        `Unsupported version contract: ${versionStatuses
          .map((status) => formatVersionStatus(status))
          .join('; ')}`
      )
    );
  }

  const artifactSummaries: ValidatedArtifactSummary[] = [];
  for (const artifact of manifest.artifacts) {
    artifactSummaries.push(await validateArtifact(artifact, fetcher));
  }

  return {
    manifest,
    artifactSummaries,
    versionStatuses
  };
};
