import { describe, expect, it } from "vitest";
import {
  assertRefKey,
  compareRefKeysCanonical,
  formatRefKey,
  isRefBook,
  isRefKey,
  parseRefKey
} from "../../src/ir/refkey";

describe("ir refkey", () => {
  it("parses and formats canonical Torah ref keys", () => {
    expect(parseRefKey("Genesis/1/1")).toEqual({
      book: "Genesis",
      chapter: 1,
      verse: 1
    });

    expect(
      formatRefKey({
        book: "Deuteronomy",
        chapter: 34,
        verse: 12
      })
    ).toBe("Deuteronomy/34/12");
  });

  it("validates book membership and canonical shape", () => {
    expect(isRefBook("Genesis")).toBe(true);
    expect(isRefBook("Psalms")).toBe(false);

    expect(isRefKey("Exodus/20/13")).toBe(true);
    expect(isRefKey("Exodus/020/13")).toBe(false);
    expect(isRefKey("Genesis/1/1/2")).toBe(false);
    expect(isRefKey("Psalms/1/1")).toBe(false);
  });

  it("rejects non-canonical or non-Torah references", () => {
    expect(() => parseRefKey("Genesis/1")).toThrow(/Invalid RefKey/);
    expect(() => parseRefKey("Genesis/01/1")).toThrow(/Invalid RefKey/);
    expect(() => parseRefKey("Psalms/1/1")).toThrow(/Invalid RefKey/);
    expect(() => parseRefKey("Genesis/1/1/2")).toThrow(/Invalid RefKey/);
    expect(() => formatRefKey({ book: "Genesis", chapter: 0, verse: 1 })).toThrow(
      /positive safe integer/
    );
  });

  it("asserts ref keys and compares in canonical Torah order", () => {
    expect(() => assertRefKey("Leviticus/3/2")).not.toThrow();
    expect(() => assertRefKey("Leviticus/3/2#g:0")).toThrow(/Invalid RefKey/);

    const refs = ["Numbers/1/1", "Genesis/1/2", "Genesis/1/1", "Exodus/1/1"];
    expect([...refs].sort(compareRefKeysCanonical)).toEqual([
      "Genesis/1/1",
      "Genesis/1/2",
      "Exodus/1/1",
      "Numbers/1/1"
    ]);
  });
});
