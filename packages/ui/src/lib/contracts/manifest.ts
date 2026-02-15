import { z } from 'zod';
import {
  isoUtcTimestampSchema,
  nonEmptyStringSchema,
  sha256HexSchema,
  versionContractSchema
} from './common';

export const requiredArtifactKinds = [
  'word_traces',
  'verse_phrase_trees',
  'word_phrase_roles'
] as const;

export const optionalArtifactKinds = [
  'render_strict_paraphrase',
  'render_poetic_paraphrase'
] as const;

export const manifestArtifactKinds = [
  ...requiredArtifactKinds,
  ...optionalArtifactKinds
] as const;

export const manifestArtifactKindSchema = z.enum(manifestArtifactKinds);

export const manifestArtifactFormatSchema = z.enum(['jsonl']);

export const manifestArtifactSchema = z
  .object({
    kind: manifestArtifactKindSchema,
    path: nonEmptyStringSchema,
    format: manifestArtifactFormatSchema,
    sha256: sha256HexSchema,
    rows: z.number().int().nonnegative().optional(),
    bytes: z.number().int().nonnegative().optional()
  })
  .strict();

export const uiDataManifestSchema = z
  .object({
    schema_version: z.literal(1),
    corpus: nonEmptyStringSchema,
    artifact_set: nonEmptyStringSchema,
    generated_at: isoUtcTimestampSchema,
    version_contract: versionContractSchema,
    artifacts: z.array(manifestArtifactSchema)
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const seenKinds = new Set<string>();
    const seenPaths = new Set<string>();

    for (let index = 0; index < manifest.artifacts.length; index += 1) {
      const artifact = manifest.artifacts[index];

      if (seenKinds.has(artifact.kind)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifacts', index, 'kind'],
          message: `Duplicate artifact kind '${artifact.kind}'`
        });
      } else {
        seenKinds.add(artifact.kind);
      }

      if (seenPaths.has(artifact.path)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifacts', index, 'path'],
          message: `Duplicate artifact path '${artifact.path}'`
        });
      } else {
        seenPaths.add(artifact.path);
      }
    }

    for (const kind of requiredArtifactKinds) {
      if (!seenKinds.has(kind)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifacts'],
          message: `Missing required artifact kind '${kind}'`
        });
      }
    }
  });

export type RequiredArtifactKind = (typeof requiredArtifactKinds)[number];
export type OptionalArtifactKind = (typeof optionalArtifactKinds)[number];
export type ManifestArtifactKind = (typeof manifestArtifactKinds)[number];

export type ManifestArtifact = z.infer<typeof manifestArtifactSchema>;
export type UiDataManifest = z.infer<typeof uiDataManifestSchema>;

export function getArtifactByKind(
  manifest: UiDataManifest,
  kind: ManifestArtifactKind
): ManifestArtifact | undefined {
  return manifest.artifacts.find((artifact) => artifact.kind === kind);
}
