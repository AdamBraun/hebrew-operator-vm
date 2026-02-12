import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BOOKS,
  buildChapters,
  buildUrl,
  main,
  normalizeChapters,
  parseArgs
} from "@ref/scripts/downloadTorah/runtime";

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("download torah runtime", () => {
  it("parses args and rejects invalid language", () => {
    const parsed = parseArgs([
      "--out=/tmp/torah.json",
      "--lang=he",
      "--he-version=H",
      "--en-version=E"
    ]);
    expect(parsed).toMatchObject({
      out: "/tmp/torah.json",
      lang: "he",
      heVersion: "H",
      enVersion: "E"
    });

    expect(() => parseArgs(["--lang=bad"])).toThrow("Invalid --lang value: bad");
  });

  it("normalizes chapter input shapes", () => {
    expect(normalizeChapters("single")).toEqual([["single"]]);
    expect(normalizeChapters(["a", "b"])).toEqual([["a", "b"]]);
    expect(normalizeChapters([["a"], ["b"]])).toEqual([["a"], ["b"]]);
  });

  it("builds chapter payloads honoring language selection", () => {
    const chapters = buildChapters([["א", "ב"]], [["A"]], "both");
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.verses[0]).toMatchObject({ n: 1, he: "א", en: "A" });
    expect(chapters[0]?.verses[1]).toMatchObject({ n: 2, he: "ב", en: "" });

    const hebrewOnly = buildChapters([["א"]], [["A"]], "he");
    expect(hebrewOnly[0]?.verses[0]).toEqual({ n: 1, he: "א" });
  });

  it("builds API URLs with optional fields", () => {
    const withLang = buildUrl("Genesis", "he", null);
    expect(withLang).toContain("Genesis");
    expect(withLang).toContain("lang=he");
    expect(withLang).toContain("commentary=0");

    const withVersion = buildUrl("Genesis", "en", "Koren");
    expect(withVersion).toContain("version=Koren");
  });

  it("writes output payload using fetched book data", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "download-torah-runtime-"));
    const outPath = path.join(tmpDir, "torah.json");

    globalThis.fetch = (async (input: URL | RequestInfo): Promise<MockResponse> => {
      const asText = String(input);
      const url = new URL(asText);
      const lang = url.searchParams.get("lang");

      if (lang === "he") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            he: [["א", "ב"]],
            heVersionTitle: "Hebrew Test",
            heVersionSource: "Hebrew Source"
          })
        };
      }
      if (lang === "en") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            text: [["A", "B"]],
            versionTitle: "English Test",
            versionSource: "English Source"
          })
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          he: [["א", "ב"]],
          text: [["A", "B"]],
          heVersionTitle: "Hebrew Test",
          heVersionSource: "Hebrew Source",
          versionTitle: "English Test",
          versionSource: "English Source"
        })
      };
    }) as typeof fetch;

    await main([`--out=${outPath}`, "--lang=both"]);

    const payload = JSON.parse(fs.readFileSync(outPath, "utf8"));
    expect(payload.lang).toBe("both");
    expect(Array.isArray(payload.books)).toBe(true);
    expect(payload.books).toHaveLength(BOOKS.length);
    expect(payload.books[0]?.chapters[0]?.verses[0]).toMatchObject({
      n: 1,
      he: "א",
      en: "A"
    });
  });
});
