import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readValidatedDataset } from '../../packages/ui/src/lib/artifacts';
import { uiDataManifestSchema } from '../../packages/ui/src/lib/contracts';

const BUNDLE_DIR = path.resolve(process.cwd(), 'packages', 'ui', 'public', 'data');

function toPathname(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.pathname;
  }
  return new URL(input.url).pathname;
}

const bundleFetcher: typeof fetch = async (input) => {
  const pathname = toPathname(input);
  if (!pathname.startsWith('/data/')) {
    return new Response('Not Found', { status: 404 });
  }

  const relPath = pathname.slice('/data/'.length);
  const filePath = path.join(BUNDLE_DIR, relPath);

  try {
    const body = await fs.readFile(filePath, 'utf8');
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
};

function countJsonlRows(content: string): number {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

describe('ui sample data bundle', () => {
  it('passes schema and runtime contract validation', async () => {
    const dataset = await readValidatedDataset(bundleFetcher);
    expect(dataset.artifactSummaries.length).toBeGreaterThanOrEqual(3);
    expect(
      dataset.artifactSummaries.some((artifact) => artifact.kind === 'word_traces')
    ).toBe(true);
    expect(
      dataset.versionStatuses.some((status) => status.level === 'error')
    ).toBe(false);
  });

  it('matches declared checksums and row counts in manifest', async () => {
    const manifestPath = path.join(BUNDLE_DIR, 'manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const parsedManifest = uiDataManifestSchema.parse(JSON.parse(manifestContent));

    for (const artifact of parsedManifest.artifacts) {
      const artifactPath = path.join(BUNDLE_DIR, artifact.path);
      const content = await fs.readFile(artifactPath, 'utf8');
      const checksum = createHash('sha256').update(content, 'utf8').digest('hex');

      expect(checksum, artifact.kind).toBe(artifact.sha256);

      if (artifact.rows !== undefined) {
        expect(countJsonlRows(content), artifact.kind).toBe(artifact.rows);
      }

      if (artifact.bytes !== undefined) {
        expect(Buffer.byteLength(content, 'utf8'), artifact.kind).toBe(artifact.bytes);
      }
    }
  });
});
