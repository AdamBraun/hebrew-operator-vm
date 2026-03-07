import { z } from "zod";

export const semVerPattern = /^\d+\.\d+\.\d+$/;
export const traceVersionPattern = /^1\.\d+\.\d+$/;
export const sha256HexPattern = /^[a-f0-9]{64}$/;
export const wordRefKeyPattern = /^[^/]+\/\d+\/\d+\/\d+$/;
export const verseRefKeyPattern = /^[^/]+\/\d+\/\d+$/;
export const isoUtcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export const traceEventKinds = [
  "ALEPH.ALIAS",
  "GIMEL.BESTOW",
  "DALET.BOUNDARY_CLOSE",
  "RESH.BOUNDARY_CLOSE",
  "HE.HEAD_WITH_LEG",
  "HE.DECLARE",
  "HE.DECLARE_BREATH",
  "HE.DECLARE_PIN",
  "HE.DECLARE_ALIAS",
  "ZAYIN.GATE",
  "HET.COMPARTMENT",
  "TET.COVERT",
  "LAMED.ENDPOINT",
  "MEM.OPEN",
  "FINAL_MEM.CLOSE",
  "NUN.SUPPORT_DEBT",
  "SAMEKH.SUPPORT_DISCHARGE",
  "PE.UTTER",
  "TSADI.ALIGN",
  "QOF.HEAD_WITH_LEG",
  "QOF.APPROX",
  "SHIN.FORK",
  "TAV.FINALIZE",
  "FINAL_NUN.SUPPORT_DEBT",
  "FINAL_NUN.SUPPORT_DISCHARGE",
  "FINAL_PE.UTTER_CLOSE",
  "FINAL_TSADI.ALIGN_FINAL",
  "SPACE.SUPPORT_DISCHARGE",
  "SPACE.BOUNDARY_AUTO_CLOSE",
  "SPACE.MEM_AUTO_CLOSE",
  "ERROR.RUNTIME",
  "ERROR.UNKNOWN_SIGNATURE",
  "EXTENSION"
] as const;

export const traceEventKindsNoExtension = traceEventKinds.filter(
  (kind) => kind !== "EXTENSION"
) as ReadonlyArray<(typeof traceEventKinds)[number]>;

export const traceEventSources = [
  "vm_event",
  "derived_obligation",
  "derived_boundary",
  "error",
  "extension"
] as const;

export const nonEmptyStringSchema = z.string().min(1);
export const semVerSchema = z.string().regex(semVerPattern, "Expected SemVer (x.y.z)");
export const traceVersionSchema = z
  .string()
  .regex(traceVersionPattern, "Expected trace version in 1.x.y format");
export const sha256HexSchema = z
  .string()
  .regex(sha256HexPattern, "Expected lowercase SHA-256 checksum");
export const isoUtcTimestampSchema = z
  .string()
  .regex(isoUtcTimestampPattern, "Expected UTC timestamp (ISO-8601, trailing Z)");

export const wordRefSchema = z
  .object({
    book: nonEmptyStringSchema,
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    token_index: z.number().int().positive()
  })
  .strict();

export const verseRefSchema = z
  .object({
    book: nonEmptyStringSchema,
    chapter: z.number().int().positive(),
    verse: z.number().int().positive()
  })
  .strict();

export const wordRefKeySchema = z
  .string()
  .regex(wordRefKeyPattern, "Expected ref_key format Book/Chapter/Verse/TokenIndex");

export const verseRefKeySchema = z
  .string()
  .regex(verseRefKeyPattern, "Expected ref_key format Book/Chapter/Verse");

export const traceEventKindSchema = z.enum(traceEventKinds);
export const traceEventKindNoExtensionSchema = z.enum([...traceEventKindsNoExtension] as [
  (typeof traceEventKindsNoExtension)[number],
  ...(typeof traceEventKindsNoExtension)[number][]
]);

export const traceEventSourceSchema = z.enum(traceEventSources);

export const versionContractSchema = z
  .object({
    trace_version: traceVersionSchema,
    semantics_version: semVerSchema,
    render_version: semVerSchema
  })
  .strict();

export type VersionContract = z.infer<typeof versionContractSchema>;
export type WordRef = z.infer<typeof wordRefSchema>;
export type VerseRef = z.infer<typeof verseRefSchema>;

export function formatValidationPath(path: Array<string | number>): string {
  if (path.length === 0) {
    return "<root>";
  }

  return path.map((segment) => (typeof segment === "number" ? `[${segment}]` : segment)).join(".");
}

export function formatZodIssue(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${formatValidationPath(issue.path)}: ${issue.message}`)
    .join("; ");
}
