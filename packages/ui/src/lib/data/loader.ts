import { z } from 'zod';
import {
  formatZodIssue,
  isoUtcTimestampSchema,
  renderOutputRecordSchema,
  semVerSchema,
  sha256HexSchema,
  versePhraseTreeRecordSchema,
  verseRefKeySchema,
  verseRefSchema,
  versionContractSchema,
  wordPhraseRoleRecordSchema,
  wordTraceRecordSchema,
  type VersePhraseTreeRecord,
  type VerseRef,
  type WordPhraseRoleRecord,
  type WordTraceRecord
} from '../contracts';
import { createLayeredTextCache, type TextCache } from './cache';

const PARSE_YIELD_THRESHOLD = 250_000;

const bundlePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) => !value.split('/').some((part) => part === '..'),
    'Path traversal is not allowed'
  );

const bundleFileEntrySchema = z
  .object({
    path: bundlePathSchema,
    kind: z.string().min(1),
    bytes: z.number().int().nonnegative(),
    sha256: sha256HexSchema,
    records: z.number().int().nonnegative().optional()
  })
  .strict();

const navigationChapterSchema = z
  .object({
    chapter: z.number().int().positive(),
    verse_count: z.number().int().nonnegative(),
    word_count: z.number().int().nonnegative()
  })
  .strict();

const navigationBookSchema = z
  .object({
    book: z.string().min(1),
    verse_count: z.number().int().nonnegative(),
    word_count: z.number().int().nonnegative(),
    chapters: z.array(navigationChapterSchema)
  })
  .strict();

const bundleManifestSchema = z
  .object({
    schema_version: z.literal(1),
    bundle_type: z.literal('letters.ui_bundle'),
    bundle_version: semVerSchema,
    corpus: z.string().min(1),
    artifact_set: z.string().min(1),
    generated_at: isoUtcTimestampSchema,
    versions: versionContractSchema,
    version_contract: versionContractSchema,
    chunk_strategy: z.literal('book_chapter_verse'),
    indexes: z
      .object({
        refs: bundlePathSchema
      })
      .strict(),
    counts: z
      .object({
        word_traces: z.number().int().nonnegative(),
        verse_phrase_trees: z.number().int().nonnegative(),
        word_phrase_roles: z.number().int().nonnegative(),
        paraphrase_records: z.number().int().nonnegative(),
        word_chunks: z.number().int().nonnegative(),
        verse_chunks: z.number().int().nonnegative(),
        paraphrase_chunks: z.number().int().nonnegative(),
        optional_index_files: z.number().int().nonnegative()
      })
      .strict(),
    navigation: z
      .object({
        books: z.array(navigationBookSchema)
      })
      .strict(),
    inputs: z
      .object({
        word_traces: z
          .object({
            path: z.string().min(1),
            rows: z.number().int().nonnegative(),
            sha256: sha256HexSchema
          })
          .strict(),
        verse_phrase_trees: z
          .object({
            path: z.string().min(1),
            rows: z.number().int().nonnegative(),
            sha256: sha256HexSchema
          })
          .strict(),
        word_phrase_roles: z
          .object({
            path: z.string().min(1),
            rows: z.number().int().nonnegative(),
            sha256: sha256HexSchema
          })
          .strict(),
        optional_source_manifest_path: z.string().min(1).optional()
      })
      .strict(),
    files: z.array(bundleFileEntrySchema)
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (JSON.stringify(manifest.versions) !== JSON.stringify(manifest.version_contract)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['version_contract'],
        message: 'versions and version_contract must match exactly'
      });
    }
  });

const refsIndexRefSchema = z
  .object({
    ref_key: verseRefKeySchema,
    ref: verseRefSchema.optional()
  })
  .passthrough();

const refsIndexMetadataSchema = z
  .object({
    books: z.array(navigationBookSchema).optional()
  })
  .passthrough();

const refsIndexSchema = z
  .object({
    schema_version: z.literal(1),
    strategy: z.literal('book_chapter_verse'),
    words: z.record(bundlePathSchema).default({}),
    verses: z.record(bundlePathSchema).default({}),
    roles: z.record(bundlePathSchema).default({}),
    paraphrase: z.record(bundlePathSchema).default({}),
    refs: z.array(refsIndexRefSchema).optional(),
    metadata: refsIndexMetadataSchema.optional()
  })
  .passthrough();

const wordTraceChunkSchema = z
  .object({
    schema_version: z.literal(1),
    chunk_kind: z.literal('word_trace_bundle_chunk'),
    verse_ref_key: verseRefKeySchema,
    ref: verseRefSchema,
    word_traces: z.array(wordTraceRecordSchema),
    word_phrase_roles: z.array(wordPhraseRoleRecordSchema)
  })
  .strict()
  .superRefine((chunk, ctx) => {
    for (let index = 0; index < chunk.word_traces.length; index += 1) {
      const record = chunk.word_traces[index];
      if (toVerseRefKey(record.ref_key) !== chunk.verse_ref_key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['word_traces', index, 'ref_key'],
          message: `word trace ref_key must belong to verse ${chunk.verse_ref_key}`
        });
      }
    }

    for (let index = 0; index < chunk.word_phrase_roles.length; index += 1) {
      const record = chunk.word_phrase_roles[index];
      if (record.ref_key !== chunk.verse_ref_key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['word_phrase_roles', index, 'ref_key'],
          message: `word phrase role ref_key must match verse ${chunk.verse_ref_key}`
        });
      }
    }
  });

const verseTreeChunkSchema = z
  .object({
    schema_version: z.literal(1),
    chunk_kind: z.literal('verse_phrase_tree_chunk'),
    verse_ref_key: verseRefKeySchema,
    ref: verseRefSchema,
    verse_phrase_tree: versePhraseTreeRecordSchema
  })
  .strict()
  .superRefine((chunk, ctx) => {
    if (chunk.verse_phrase_tree.ref_key !== chunk.verse_ref_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verse_phrase_tree', 'ref_key'],
        message: `verse phrase tree ref_key must match verse ${chunk.verse_ref_key}`
      });
    }
  });

const paraphraseChunkSchema = z
  .object({
    schema_version: z.literal(1),
    chunk_kind: z.literal('paraphrase_chunk'),
    verse_ref_key: verseRefKeySchema,
    ref: verseRefSchema,
    records: z.array(renderOutputRecordSchema)
  })
  .strict();

export type BundleManifest = z.infer<typeof bundleManifestSchema>;
export type RefsIndex = z.infer<typeof refsIndexSchema>;
export type WordTraceChunk = z.infer<typeof wordTraceChunkSchema>;
export type VerseTreeChunk = z.infer<typeof verseTreeChunkSchema>;
export type ParaphraseChunk = z.infer<typeof paraphraseChunkSchema>;
export type BundleNavigationBook = z.infer<typeof navigationBookSchema>;
export type BundleNavigationChapter = z.infer<typeof navigationChapterSchema>;

export interface VerseReferenceEntry {
  ref_key: string;
  ref: VerseRef;
}

export interface ReferenceCatalog {
  refs: VerseReferenceEntry[];
  navigation: BundleManifest['navigation'];
}

export interface BundleLoaderOptions {
  fetcher?: typeof fetch;
  baseDataPath?: string;
  cache?: TextCache;
  useIndexedDb?: boolean;
}

export interface BundleInfo {
  version_tag: string;
  manifest_path: string;
  refs_index_path: string;
  bundle_version: string;
  corpus: string;
  artifact_set: string;
  generated_at: string;
  version_contract: BundleManifest['version_contract'];
  counts: BundleManifest['counts'];
}

export interface BundleSnapshot {
  info: BundleInfo;
  manifest: BundleManifest;
  refsIndex: RefsIndex;
}

export interface VerseBundle {
  ref_key: string;
  ref: VerseRef;
  word_traces: WordTraceRecord[];
  word_phrase_roles: WordPhraseRoleRecord[];
  phrase_tree: VersePhraseTreeRecord | null;
}

export type BundleLoaderErrorCode =
  | 'bundle_not_loaded'
  | 'fetch_failed'
  | 'missing_chunk'
  | 'invalid_json'
  | 'schema_mismatch';

export class BundleLoaderError extends Error {
  readonly code: BundleLoaderErrorCode;

  constructor(code: BundleLoaderErrorCode, message: string) {
    super(message);
    this.name = 'BundleLoaderError';
    this.code = code;
  }
}

type LoadedBundleState = {
  info: BundleInfo;
  bundleRootPath: string;
  manifest: BundleManifest;
  refsIndex: RefsIndex;
};

export class BundleLoader {
  private readonly fetcher: typeof fetch;
  private readonly baseDataPath: string;
  private readonly cache: TextCache;

  private state: LoadedBundleState | null = null;
  private readonly inFlightText = new Map<string, Promise<string>>();
  private readonly wordChunks = new Map<string, WordTraceChunk>();
  private readonly verseChunks = new Map<string, VerseTreeChunk>();
  private readonly paraphraseChunks = new Map<string, ParaphraseChunk>();

  constructor(options: BundleLoaderOptions = {}) {
    this.fetcher =
      options.fetcher ??
      ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
    this.baseDataPath = normalizeBaseDataPath(options.baseDataPath ?? '/data');
    this.cache =
      options.cache ??
      createLayeredTextCache({
        namespace: 'letters-ui-bundle',
        useIndexedDb: options.useIndexedDb
      });
  }

  getBundleInfo(): BundleInfo | null {
    return this.state?.info ?? null;
  }

  getBundleSnapshot(): BundleSnapshot {
    const state = this.ensureLoaded();
    return {
      info: state.info,
      manifest: state.manifest,
      refsIndex: state.refsIndex
    };
  }

  getReferenceCatalog(): ReferenceCatalog {
    const state = this.ensureLoaded();
    return {
      refs: deriveVerseReferenceEntries(state.refsIndex, state.manifest.navigation.books),
      navigation: state.manifest.navigation
    };
  }

  async loadBundle(versionTag = 'latest'): Promise<BundleInfo> {
    const normalizedVersionTag = normalizeVersionTag(versionTag);
    const bundleRootPath = resolveBundleRoot(this.baseDataPath, normalizedVersionTag);
    const manifestPath = `${bundleRootPath}/ui-manifest.json`;

    const manifest = await this.readJsonDocument(
      manifestPath,
      bundleManifestSchema,
      'bundle manifest'
    );
    const refsIndexPath = resolveBundleAssetPath(bundleRootPath, manifest.indexes.refs);
    const refsIndex = await this.readJsonDocument(
      refsIndexPath,
      refsIndexSchema,
      'refs index'
    );

    const info: BundleInfo = {
      version_tag: normalizedVersionTag,
      manifest_path: manifestPath,
      refs_index_path: refsIndexPath,
      bundle_version: manifest.bundle_version,
      corpus: manifest.corpus,
      artifact_set: manifest.artifact_set,
      generated_at: manifest.generated_at,
      version_contract: manifest.version_contract,
      counts: manifest.counts
    };

    const currentPath = this.state?.info.manifest_path;
    if (currentPath !== manifestPath) {
      this.wordChunks.clear();
      this.verseChunks.clear();
      this.paraphraseChunks.clear();
    }

    this.state = {
      info,
      bundleRootPath,
      manifest,
      refsIndex
    };

    return info;
  }

  async getVerse(refKey: string): Promise<VerseBundle | null> {
    const verseRefKey = validateVerseRefKeyInput(refKey);
    const [wordChunk, treeChunk] = await Promise.all([
      this.loadWordChunkByVerseRef(verseRefKey),
      this.loadVerseChunkByVerseRef(verseRefKey)
    ]);

    if (!wordChunk && !treeChunk) {
      return null;
    }

    const ref = wordChunk?.ref ?? treeChunk?.ref;
    if (!ref) {
      return null;
    }

    return {
      ref_key: verseRefKey,
      ref,
      word_traces: wordChunk?.word_traces ?? [],
      word_phrase_roles: wordChunk?.word_phrase_roles ?? [],
      phrase_tree: treeChunk?.verse_phrase_tree ?? null
    };
  }

  async getWords(refKey: string): Promise<WordTraceRecord[]> {
    const verseRefKey = validateVerseRefKeyInput(refKey);
    const wordChunk = await this.loadWordChunkByVerseRef(verseRefKey);
    return wordChunk?.word_traces ?? [];
  }

  async getWord(refKey: string, wordIndex: number): Promise<WordTraceRecord | null> {
    if (!Number.isInteger(wordIndex) || wordIndex < 1) {
      throw new BundleLoaderError(
        'schema_mismatch',
        `wordIndex must be a positive integer (received ${String(wordIndex)})`
      );
    }

    const words = await this.getWords(refKey);
    const found = words.find((record) => record.ref.token_index === wordIndex);
    return found ?? null;
  }

  async getPhraseTree(refKey: string): Promise<VersePhraseTreeRecord | null> {
    const verseRefKey = validateVerseRefKeyInput(refKey);
    const treeChunk = await this.loadVerseChunkByVerseRef(verseRefKey);
    return treeChunk?.verse_phrase_tree ?? null;
  }

  async getParaphraseChunk(refKey: string): Promise<ParaphraseChunk | null> {
    const verseRefKey = validateVerseRefKeyInput(refKey);
    const state = this.ensureLoaded();
    const chunkRelPath = state.refsIndex.paraphrase[verseRefKey];
    if (!chunkRelPath) {
      return null;
    }

    const chunkPath = resolveBundleAssetPath(state.bundleRootPath, chunkRelPath);
    const cached = this.paraphraseChunks.get(chunkPath);
    if (cached) {
      return cached;
    }

    const parsed = await this.readJsonDocument(
      chunkPath,
      paraphraseChunkSchema,
      `paraphrase chunk for ${verseRefKey}`
    );
    this.paraphraseChunks.set(chunkPath, parsed);
    return parsed;
  }

  private async loadWordChunkByVerseRef(verseRefKey: string): Promise<WordTraceChunk | null> {
    const state = this.ensureLoaded();
    const chunkRelPath = state.refsIndex.roles[verseRefKey];
    if (!chunkRelPath) {
      return null;
    }

    const chunkPath = resolveBundleAssetPath(state.bundleRootPath, chunkRelPath);
    const cached = this.wordChunks.get(chunkPath);
    if (cached) {
      return cached;
    }

    const parsed = await this.readJsonDocument(
      chunkPath,
      wordTraceChunkSchema,
      `words chunk for ${verseRefKey}`
    );
    this.wordChunks.set(chunkPath, parsed);
    return parsed;
  }

  private async loadVerseChunkByVerseRef(verseRefKey: string): Promise<VerseTreeChunk | null> {
    const state = this.ensureLoaded();
    const chunkRelPath = state.refsIndex.verses[verseRefKey];
    if (!chunkRelPath) {
      return null;
    }

    const chunkPath = resolveBundleAssetPath(state.bundleRootPath, chunkRelPath);
    const cached = this.verseChunks.get(chunkPath);
    if (cached) {
      return cached;
    }

    const parsed = await this.readJsonDocument(
      chunkPath,
      verseTreeChunkSchema,
      `verse chunk for ${verseRefKey}`
    );
    this.verseChunks.set(chunkPath, parsed);
    return parsed;
  }

  private ensureLoaded(): LoadedBundleState {
    if (!this.state) {
      throw new BundleLoaderError(
        'bundle_not_loaded',
        'No UI bundle is loaded. Call loadBundle(versionTag) before querying data.'
      );
    }
    return this.state;
  }

  private async readJsonDocument<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    label: string
  ): Promise<T> {
    const raw = await this.readText(path, label);
    const parsedJson = await parseJsonAsync(raw, path);
    const result = schema.safeParse(parsedJson);
    if (!result.success) {
      throw new BundleLoaderError(
        'schema_mismatch',
        `Data contract violation in ${path}: ${formatZodIssue(result.error)}`
      );
    }
    return result.data;
  }

  private async readText(path: string, label: string): Promise<string> {
    const cacheKey = `text:${path}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const inFlight = this.inFlightText.get(path);
    if (inFlight) {
      return inFlight;
    }

    const request = (async (): Promise<string> => {
      let response: Response;
      try {
        response = await this.fetcher(path);
      } catch (error) {
        throw new BundleLoaderError(
          'fetch_failed',
          `Failed to fetch ${label} at ${path}: ${String(error)}`
        );
      }

      if (!response.ok) {
        const code: BundleLoaderErrorCode =
          response.status === 404 ? 'missing_chunk' : 'fetch_failed';
        throw new BundleLoaderError(
          code,
          `Failed to fetch ${label} at ${path} (${response.status})`
        );
      }

      const text = await response.text();
      await this.cache.set(cacheKey, text);
      return text;
    })();

    this.inFlightText.set(path, request);
    try {
      return await request;
    } finally {
      this.inFlightText.delete(path);
    }
  }
}

function deriveVerseReferenceEntries(
  refsIndex: RefsIndex,
  navigationBooks: BundleNavigationBook[]
): VerseReferenceEntry[] {
  const byRefKey = new Map<string, VerseReferenceEntry>();

  const addRef = (candidateRefKey: string, providedRef?: VerseRef): void => {
    const validatedRefKey = validateVerseRefKeyCandidate(candidateRefKey);
    if (!validatedRefKey || byRefKey.has(validatedRefKey)) {
      return;
    }

    const parsedRef = parseVerseRefKeyOrNull(validatedRefKey);
    if (!parsedRef) {
      return;
    }

    if (providedRef) {
      const providedRefKey = `${providedRef.book}/${providedRef.chapter}/${providedRef.verse}`;
      if (providedRefKey === validatedRefKey) {
        byRefKey.set(validatedRefKey, {
          ref_key: validatedRefKey,
          ref: providedRef
        });
        return;
      }
    }

    byRefKey.set(validatedRefKey, {
      ref_key: validatedRefKey,
      ref: parsedRef
    });
  };

  for (const entry of refsIndex.refs ?? []) {
    addRef(entry.ref_key, entry.ref);
  }

  for (const verseRefKey of Object.keys(refsIndex.verses)) {
    addRef(verseRefKey);
  }

  for (const verseRefKey of Object.keys(refsIndex.roles)) {
    addRef(verseRefKey);
  }

  for (const wordRefKey of Object.keys(refsIndex.words)) {
    const derivedRefKey = toVerseRefKeyOrNull(wordRefKey);
    if (derivedRefKey) {
      addRef(derivedRefKey);
    }
  }

  if (byRefKey.size === 0) {
    for (const book of navigationBooks) {
      for (const chapter of book.chapters) {
        for (let verse = 1; verse <= chapter.verse_count; verse += 1) {
          addRef(`${book.book}/${chapter.chapter}/${verse}`);
        }
      }
    }
  }

  const bookOrder = buildBookOrder(navigationBooks);
  return Array.from(byRefKey.values()).sort((left, right) =>
    compareVerseReferenceEntries(left, right, bookOrder)
  );
}

function buildBookOrder(books: BundleNavigationBook[]): Map<string, number> {
  const order = new Map<string, number>();
  for (let index = 0; index < books.length; index += 1) {
    order.set(books[index].book, index);
  }
  return order;
}

function compareVerseReferenceEntries(
  left: VerseReferenceEntry,
  right: VerseReferenceEntry,
  bookOrder: Map<string, number>
): number {
  const leftBookOrder = bookOrder.get(left.ref.book);
  const rightBookOrder = bookOrder.get(right.ref.book);

  if (leftBookOrder !== undefined || rightBookOrder !== undefined) {
    if (leftBookOrder === undefined) {
      return 1;
    }
    if (rightBookOrder === undefined) {
      return -1;
    }
    if (leftBookOrder !== rightBookOrder) {
      return leftBookOrder - rightBookOrder;
    }
  } else {
    const bookCmp = left.ref.book.localeCompare(right.ref.book);
    if (bookCmp !== 0) {
      return bookCmp;
    }
  }

  if (left.ref.chapter !== right.ref.chapter) {
    return left.ref.chapter - right.ref.chapter;
  }

  if (left.ref.verse !== right.ref.verse) {
    return left.ref.verse - right.ref.verse;
  }

  return left.ref_key.localeCompare(right.ref_key);
}

function normalizeBaseDataPath(input: string): string {
  const normalized = String(input).trim().replace(/\/+$/g, '');
  return normalized.length > 0 ? normalized : '/data';
}

function normalizeVersionTag(input: string): string {
  const normalized = String(input).trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    throw new BundleLoaderError('schema_mismatch', 'versionTag must be a non-empty string');
  }
  if (normalized.includes('..')) {
    throw new BundleLoaderError('schema_mismatch', `Invalid versionTag '${input}'`);
  }
  return normalized;
}

function resolveBundleRoot(baseDataPath: string, versionTag: string): string {
  return `${baseDataPath}/${versionTag}`;
}

function resolveBundleAssetPath(bundleRootPath: string, assetPath: string): string {
  if (assetPath.startsWith('/')) {
    return assetPath;
  }
  return `${bundleRootPath}/${assetPath.replace(/^\/+/g, '')}`;
}

function toVerseRefKey(wordRefKey: string): string {
  const parts = String(wordRefKey).split('/');
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

function toVerseRefKeyOrNull(wordRefKey: string): string | null {
  const parts = String(wordRefKey).split('/');
  if (parts.length < 3) {
    return null;
  }
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

function parseVerseRefKeyOrNull(refKey: string): VerseRef | null {
  const validatedRefKey = validateVerseRefKeyCandidate(refKey);
  if (!validatedRefKey) {
    return null;
  }

  const [book, chapterRaw, verseRaw] = validatedRefKey.split('/');
  const chapter = Number(chapterRaw);
  const verse = Number(verseRaw);

  if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse)) {
    return null;
  }

  return {
    book,
    chapter,
    verse
  };
}

function validateVerseRefKeyCandidate(refKey: string): string | null {
  const result = verseRefKeySchema.safeParse(refKey);
  return result.success ? result.data : null;
}

function validateVerseRefKeyInput(refKey: string): string {
  const result = verseRefKeySchema.safeParse(refKey);
  if (!result.success) {
    throw new BundleLoaderError(
      'schema_mismatch',
      `Invalid verse ref_key '${refKey}': ${formatZodIssue(result.error)}`
    );
  }
  return result.data;
}

async function parseJsonAsync(raw: string, sourcePath: string): Promise<unknown> {
  if (raw.length >= PARSE_YIELD_THRESHOLD) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new BundleLoaderError(
      'invalid_json',
      `Invalid JSON in ${sourcePath}: ${String(error)}`
    );
  }
}
