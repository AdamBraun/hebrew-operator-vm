import { z } from 'zod';

const paraphraseRefKeyPattern = /^[^/]+\/\d+\/\d+(?:\/\d+)?$/;

export const renderOutputStyleSchema = z.enum(['strict', 'poetic']);

export const renderOutputRecordSchema = z
  .object({
    ref_key: z
      .string()
      .regex(
        paraphraseRefKeyPattern,
        'Expected ref_key format Book/Chapter/Verse[/TokenIndex]'
      ),
    style: renderOutputStyleSchema,
    text: z.string().min(1),
    metadata: z.record(z.unknown()).optional()
  })
  .strict();

export const strictParaphraseRecordSchema = renderOutputRecordSchema.extend({
  style: z.literal('strict')
});

export const poeticParaphraseRecordSchema = renderOutputRecordSchema.extend({
  style: z.literal('poetic')
});

export type RenderOutputRecord = z.infer<typeof renderOutputRecordSchema>;
export type StrictParaphraseRecord = z.infer<typeof strictParaphraseRecordSchema>;
export type PoeticParaphraseRecord = z.infer<typeof poeticParaphraseRecordSchema>;
