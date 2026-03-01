import fs from "node:fs/promises";
import path from "node:path";
import { type SpineRecord } from "../../spine/schema";
import { classifyLetterOperator, isSupportedLetterOperator } from "./opMap";
import {
  assertLettersIRRecordsAgainstSpine,
  serializeLettersIRRecord,
  type LettersIRRecord
} from "./schema";
import { assignWordIds } from "./wordSeg";

export type ExtractLettersIRForRefArgs = {
  spineRecordsForRef: Iterable<SpineRecord>;
  spineDigest: string;
  includeWordMetadata?: boolean;
};

export type WriteExtractedLettersIRArgs = ExtractLettersIRForRefArgs & {
  outputPath: string;
};

export type WriteExtractedLettersIRResult = {
  outputPath: string;
  recordsWritten: number;
};

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`extractLettersIRRecordsForRef: ${label} must be lowercase sha256 hex`);
  }
}

export function extractLettersIRRecordsForRef(args: ExtractLettersIRForRefArgs): LettersIRRecord[] {
  assertSha256Hex(args.spineDigest, "spineDigest");

  const spineRows = [...args.spineRecordsForRef];
  const includeWord = args.includeWordMetadata !== false;
  const wordByGid = includeWord ? assignWordIds(spineRows) : new Map();
  const out: LettersIRRecord[] = [];

  for (const row of spineRows) {
    if (row.kind !== "g") {
      continue;
    }
    if (typeof row.base_letter !== "string") {
      continue;
    }
    if (!isSupportedLetterOperator(row.base_letter)) {
      continue;
    }

    const classification = classifyLetterOperator(row.base_letter);
    const wordAnchor = wordByGid.get(row.gid);
    if (includeWord && !wordAnchor) {
      throw new Error(
        `extractLettersIRRecordsForRef: missing word assignment for gid='${row.gid}' in ref '${row.ref_key}'`
      );
    }

    out.push({
      kind: "letter_ir",
      gid: row.gid,
      ref_key: row.ref_key,
      g_index: row.g_index,
      letter: classification.letter,
      op_kind: classification.op_kind,
      features: classification.features,
      ...(includeWord && wordAnchor
        ? {
            word: {
              id: wordAnchor.wordId,
              index_in_word: wordAnchor.indexInWord
            }
          }
        : {}),
      source: {
        spine_digest: args.spineDigest
      }
    });
  }

  assertLettersIRRecordsAgainstSpine(out, spineRows);
  return out;
}

export async function writeExtractedLettersIRJsonl(
  args: WriteExtractedLettersIRArgs
): Promise<WriteExtractedLettersIRResult> {
  const records = extractLettersIRRecordsForRef(args);
  await fs.mkdir(path.dirname(args.outputPath), { recursive: true });

  const handle = await fs.open(args.outputPath, "w");
  let recordsWritten = 0;

  try {
    for (const record of records) {
      await handle.write(`${serializeLettersIRRecord(record)}\n`);
      recordsWritten += 1;
    }
  } finally {
    await handle.close();
  }

  return {
    outputPath: args.outputPath,
    recordsWritten
  };
}
