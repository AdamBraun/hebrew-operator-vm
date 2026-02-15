import { z } from 'zod';
import {
  traceEventKindNoExtensionSchema,
  traceEventKindSchema,
  traceEventSourceSchema,
  traceVersionSchema,
  semVerSchema,
  wordRefKeySchema,
  wordRefSchema,
  sha256HexSchema
} from './common';

export const flowModeSchema = z.enum(['WORD', 'VERSE', 'WINDOW']);

export const wordTraceEventSchema = z
  .object({
    kind: traceEventKindSchema,
    index: z.number().int().nonnegative(),
    tau: z.number().int().nonnegative(),
    source: traceEventSourceSchema,
    payload: z.record(z.unknown())
  })
  .strict();

export const wordTraceRecordSchema = z
  .object({
    record_kind: z.literal('WORD_TRACE'),
    trace_version: traceVersionSchema,
    semantics_version: semVerSchema,
    render_version: semVerSchema,
    ref: wordRefSchema,
    ref_key: wordRefKeySchema,
    surface: z.string(),
    token_ids: z.array(z.number().int().nonnegative()),
    events: z.array(wordTraceEventSchema),
    skeleton: z.array(traceEventKindNoExtensionSchema).optional(),
    flow: z.string().optional(),
    mode: flowModeSchema.optional(),
    window_start: z.number().int().positive().optional(),
    canonical_hash: sha256HexSchema.optional(),
    extensions: z.record(z.unknown()).optional()
  })
  .strict()
  .superRefine((record, ctx) => {
    if (record.window_start !== undefined && record.mode !== 'WINDOW') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['window_start'],
        message: 'window_start is only allowed when mode is WINDOW'
      });
    }
  });

export type FlowMode = z.infer<typeof flowModeSchema>;
export type WordTraceEvent = z.infer<typeof wordTraceEventSchema>;
export type WordTraceRecord = z.infer<typeof wordTraceRecordSchema>;
