import { z } from 'zod';
import { nonEmptyStringSchema, verseRefKeySchema } from './common';
import { primaryAccentSchema } from './versePhraseTrees';

export const phraseRoleSchema = z.enum(['HEAD', 'TAIL', 'JOIN', 'SPLIT']);

export const wordPhraseRoleRecordSchema = z
  .object({
    ref_key: verseRefKeySchema,
    word_index: z.number().int().positive(),
    surface: z.string(),
    primary_accent: primaryAccentSchema,
    phrase_role: phraseRoleSchema,
    phrase_path: z.array(nonEmptyStringSchema).min(1),
    clause_id: nonEmptyStringSchema,
    subclause_id: nonEmptyStringSchema,
    phrase_version: nonEmptyStringSchema
  })
  .strict();

export type PhraseRole = z.infer<typeof phraseRoleSchema>;
export type WordPhraseRoleRecord = z.infer<typeof wordPhraseRoleRecordSchema>;
