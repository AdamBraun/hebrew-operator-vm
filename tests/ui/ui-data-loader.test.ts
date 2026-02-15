import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLayeredTextCache } from "../../packages/ui/src/lib/data/cache";
import { BundleLoader } from "../../packages/ui/src/lib/data/loader";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "ui-contract");
const WORD_CHUNK_PATH = "chunks/words/genesis-fixture/001/001.json";
const VERSE_CHUNK_PATH = "chunks/verses/genesis-fixture/001/001.json";

type FixtureDocs = Record<string, string>;
type FetchCallCounts = Map<string, number>;

function loadJsonFixture(fileName: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fileName), "utf8")) as Record<
    string,
    unknown
  >;
}

function toPathname(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.pathname;
  }
  return new URL(input.url).pathname;
}

function buildFixtureDocs(opts?: { invalidWordChunk?: boolean }): FixtureDocs {
  const wordTrace = loadJsonFixture("valid.word_trace.json");
  const wordRole = loadJsonFixture("valid.word_phrase_role.json");
  const verseTree = loadJsonFixture("valid.verse_phrase_tree.json");

  const wordRecord = opts?.invalidWordChunk
    ? (() => {
        const cloned = { ...wordTrace };
        delete (cloned as Record<string, unknown>).trace_version;
        return cloned;
      })()
    : wordTrace;

  const refsIndex = {
    schema_version: 1,
    strategy: "book_chapter_verse",
    words: {
      "Genesis/1/1/1": WORD_CHUNK_PATH
    },
    verses: {
      "Genesis/1/1": VERSE_CHUNK_PATH
    },
    roles: {
      "Genesis/1/1": WORD_CHUNK_PATH
    },
    paraphrase: {}
  };

  const manifest = {
    schema_version: 1,
    bundle_type: "letters.ui_bundle",
    bundle_version: "1.0.0",
    corpus: "torah-corpus",
    artifact_set: "fixture",
    generated_at: "2026-02-15T00:00:00.000Z",
    versions: {
      trace_version: "1.1.0",
      semantics_version: "1.1.0",
      render_version: "1.1.0"
    },
    version_contract: {
      trace_version: "1.1.0",
      semantics_version: "1.1.0",
      render_version: "1.1.0"
    },
    chunk_strategy: "book_chapter_verse",
    indexes: {
      refs: "refs/index.json"
    },
    counts: {
      word_traces: 1,
      verse_phrase_trees: 1,
      word_phrase_roles: 1,
      paraphrase_records: 0,
      word_chunks: 1,
      verse_chunks: 1,
      paraphrase_chunks: 0,
      optional_index_files: 0
    },
    navigation: {
      books: [
        {
          book: "Genesis",
          verse_count: 1,
          word_count: 1,
          chapters: [
            {
              chapter: 1,
              verse_count: 1,
              word_count: 1
            }
          ]
        }
      ]
    },
    inputs: {
      word_traces: {
        path: "corpus/word_traces.jsonl",
        rows: 1,
        sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      verse_phrase_trees: {
        path: "corpus/verse_phrase_trees.jsonl",
        rows: 1,
        sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      },
      word_phrase_roles: {
        path: "corpus/word_phrase_roles.jsonl",
        rows: 1,
        sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
      }
    },
    files: [
      {
        path: WORD_CHUNK_PATH,
        kind: "words_chunk",
        bytes: 1,
        sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        records: 2
      },
      {
        path: VERSE_CHUNK_PATH,
        kind: "verses_chunk",
        bytes: 1,
        sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        records: 1
      },
      {
        path: "refs/index.json",
        kind: "refs_index",
        bytes: 1,
        sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        records: 2
      }
    ]
  };

  const wordChunk = {
    schema_version: 1,
    chunk_kind: "word_trace_bundle_chunk",
    verse_ref_key: "Genesis/1/1",
    ref: {
      book: "Genesis",
      chapter: 1,
      verse: 1
    },
    word_traces: [wordRecord],
    word_phrase_roles: [wordRole]
  };

  const verseChunk = {
    schema_version: 1,
    chunk_kind: "verse_phrase_tree_chunk",
    verse_ref_key: "Genesis/1/1",
    ref: {
      book: "Genesis",
      chapter: 1,
      verse: 1
    },
    verse_phrase_tree: verseTree
  };

  return {
    "/data/latest/ui-manifest.json": `${JSON.stringify(manifest)}\n`,
    "/data/latest/refs/index.json": `${JSON.stringify(refsIndex)}\n`,
    "/data/latest/chunks/words/genesis-fixture/001/001.json": `${JSON.stringify(wordChunk)}\n`,
    "/data/latest/chunks/verses/genesis-fixture/001/001.json": `${JSON.stringify(verseChunk)}\n`
  };
}

function createFixtureFetcher(docs: FixtureDocs): {
  fetcher: typeof fetch;
  calls: FetchCallCounts;
} {
  const calls: FetchCallCounts = new Map<string, number>();

  const fetcher: typeof fetch = async (input) => {
    const pathname = toPathname(input);
    calls.set(pathname, (calls.get(pathname) ?? 0) + 1);

    const body = docs[pathname];
    if (!body) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  };

  return { fetcher, calls };
}

function createTestLoader(fetcher: typeof fetch): BundleLoader {
  return new BundleLoader({
    fetcher,
    baseDataPath: "/data",
    cache: createLayeredTextCache({
      namespace: "ui-loader-test",
      useIndexedDb: false
    })
  });
}

describe("ui data loader", () => {
  it("loads and validates ui-manifest.json", async () => {
    const { fetcher, calls } = createFixtureFetcher(buildFixtureDocs());
    const loader = createTestLoader(fetcher);

    const info = await loader.loadBundle("latest");

    expect(info.version_tag).toBe("latest");
    expect(info.bundle_version).toBe("1.0.0");
    expect(info.artifact_set).toBe("fixture");
    expect(calls.get("/data/latest/ui-manifest.json")).toBe(1);
    expect(calls.get("/data/latest/refs/index.json")).toBe(1);
  });

  it("fetches each chunk only once and serves subsequent lookups from cache", async () => {
    const { fetcher, calls } = createFixtureFetcher(buildFixtureDocs());
    const loader = createTestLoader(fetcher);
    await loader.loadBundle("latest");

    const firstWords = await loader.getWords("Genesis/1/1");
    const secondWords = await loader.getWords("Genesis/1/1");
    const firstWord = await loader.getWord("Genesis/1/1", 1);
    const verse = await loader.getVerse("Genesis/1/1");
    const tree = await loader.getPhraseTree("Genesis/1/1");

    expect(firstWords).toHaveLength(1);
    expect(secondWords).toHaveLength(1);
    expect(firstWord?.ref_key).toBe("Genesis/1/1/1");
    expect(tree?.ref_key).toBe("Genesis/1/1");
    expect(verse?.word_traces).toHaveLength(1);
    expect(calls.get("/data/latest/chunks/words/genesis-fixture/001/001.json")).toBe(1);
    expect(calls.get("/data/latest/chunks/verses/genesis-fixture/001/001.json")).toBe(1);
  });

  it("exposes normalized references from refs/index.json", async () => {
    const { fetcher } = createFixtureFetcher(buildFixtureDocs());
    const loader = createTestLoader(fetcher);
    await loader.loadBundle("latest");

    const catalog = loader.getReferenceCatalog();

    expect(catalog.refs).toHaveLength(1);
    expect(catalog.refs[0]).toEqual({
      ref_key: "Genesis/1/1",
      ref: {
        book: "Genesis",
        chapter: 1,
        verse: 1
      }
    });
    expect(catalog.navigation.books[0]?.book).toBe("Genesis");
  });

  it("rejects chunk payloads that violate record contracts", async () => {
    const { fetcher } = createFixtureFetcher(
      buildFixtureDocs({
        invalidWordChunk: true
      })
    );
    const loader = createTestLoader(fetcher);
    await loader.loadBundle("latest");

    await expect(loader.getWords("Genesis/1/1")).rejects.toThrow(/Data contract violation/);
  });
});
