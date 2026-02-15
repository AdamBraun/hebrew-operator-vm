import { z } from 'zod';
import { nonEmptyStringSchema, verseRefKeySchema, verseRefSchema } from './common';

const codepointPattern = /^U\+[0-9A-F]{4,6}$/;

export const primaryAccentClassSchema = z.enum([
  'DISJUNCTIVE',
  'CONJUNCTIVE',
  'NONE'
]);

export const primaryAccentSchema = z
  .object({
    word_index: z.number().int().positive(),
    class: primaryAccentClassSchema,
    codepoint: z.string().regex(codepointPattern).nullable(),
    name: z.string().min(1).nullable(),
    precedence: z.number().int().nonnegative(),
    observed_teamim: z.array(z.string().regex(codepointPattern))
  })
  .strict();

export const nodeSpanSchema = z
  .object({
    start: z.number().int().positive(),
    end: z.number().int().positive()
  })
  .strict()
  .superRefine((span, ctx) => {
    if (span.start > span.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'span.end must be >= span.start'
      });
    }
  });

export type PhraseLeafNode = {
  id: string;
  node_type: 'LEAF';
  span: z.infer<typeof nodeSpanSchema>;
  word_index: number;
  surface: string;
  accent: z.infer<typeof primaryAccentSchema>;
};

export type PhraseJoinNode = {
  id: string;
  node_type: 'JOIN';
  span: z.infer<typeof nodeSpanSchema>;
  fold: 'LEFT';
  left: PhraseNode;
  right: PhraseNode;
};

export type PhraseSplitNode = {
  id: string;
  node_type: 'SPLIT';
  span: z.infer<typeof nodeSpanSchema>;
  split_word_index: number;
  split_accent: {
    codepoint: string;
    name: string | null;
    precedence: number;
  };
  left: PhraseNode;
  right: PhraseNode;
};

export type PhraseNode = PhraseLeafNode | PhraseJoinNode | PhraseSplitNode;

export const phraseNodeSchema: z.ZodType<PhraseNode> = z.lazy(() =>
  z.union([phraseLeafNodeSchema, phraseJoinNodeSchema, phraseSplitNodeSchema])
);

export const phraseLeafNodeSchema: z.ZodType<PhraseLeafNode> = z
  .object({
    id: nonEmptyStringSchema,
    node_type: z.literal('LEAF'),
    span: nodeSpanSchema,
    word_index: z.number().int().positive(),
    surface: z.string(),
    accent: primaryAccentSchema
  })
  .strict();

export const phraseJoinNodeSchema: z.ZodType<PhraseJoinNode> = z
  .object({
    id: nonEmptyStringSchema,
    node_type: z.literal('JOIN'),
    span: nodeSpanSchema,
    fold: z.literal('LEFT'),
    left: phraseNodeSchema,
    right: phraseNodeSchema
  })
  .strict();

export const phraseSplitNodeSchema: z.ZodType<PhraseSplitNode> = z
  .object({
    id: nonEmptyStringSchema,
    node_type: z.literal('SPLIT'),
    span: nodeSpanSchema,
    split_word_index: z.number().int().positive(),
    split_accent: z
      .object({
        codepoint: z.string().regex(codepointPattern),
        name: z.string().min(1).nullable(),
        precedence: z.number().int().nonnegative()
      })
      .strict(),
    left: phraseNodeSchema,
    right: phraseNodeSchema
  })
  .strict();

export const versePhraseTreeRecordSchema = z
  .object({
    ref_key: verseRefKeySchema,
    ref: verseRefSchema,
    words: z.array(z.string()).min(1),
    primary_accents: z.array(primaryAccentSchema),
    tree: phraseNodeSchema,
    phrase_version: nonEmptyStringSchema
  })
  .strict()
  .superRefine((record, ctx) => {
    if (record.primary_accents.length !== record.words.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primary_accents'],
        message: 'primary_accents length must match words length'
      });
    }
  });

export type PrimaryAccent = z.infer<typeof primaryAccentSchema>;
export type VersePhraseTreeRecord = z.infer<typeof versePhraseTreeRecordSchema>;
