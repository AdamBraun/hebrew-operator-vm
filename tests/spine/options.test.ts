import { describe, expect, it } from "vitest";
import {
  defaultNormalizationOptions,
  normalizeOptions,
  type NormalizationOptions
} from "../../src/spine/options";

describe("spine normalization options", () => {
  it("returns stable defaults", () => {
    const defaults = defaultNormalizationOptions();
    expect(defaults).toEqual<NormalizationOptions>({
      unicodeForm: "NFC",
      normalizeFinals: false,
      stripControlChars: true,
      preservePunctuation: true,
      errorOnUnknownMark: false
    });
  });

  it("fills missing fields from defaults", () => {
    expect(normalizeOptions({ normalizeFinals: true })).toEqual<NormalizationOptions>({
      unicodeForm: "NFC",
      normalizeFinals: true,
      stripControlChars: true,
      preservePunctuation: true,
      errorOnUnknownMark: false
    });
  });

  it("accepts all supported unicode forms", () => {
    expect(normalizeOptions({ unicodeForm: "NFC" }).unicodeForm).toBe("NFC");
    expect(normalizeOptions({ unicodeForm: "NFKD" }).unicodeForm).toBe("NFKD");
    expect(normalizeOptions({ unicodeForm: "none" }).unicodeForm).toBe("none");
  });

  it("rejects unknown option keys to avoid silent behavior changes", () => {
    expect(() =>
      normalizeOptions({ unexpected: true } as unknown as Partial<NormalizationOptions>)
    ).toThrow(/unknown option/);
  });

  it("rejects wrong option types", () => {
    expect(() => normalizeOptions({ normalizeFinals: "true" as unknown as boolean })).toThrow(
      /normalizeFinals must be boolean/
    );
    expect(() => normalizeOptions({ unicodeForm: "NFD" as unknown as "NFC" })).toThrow(
      /unicodeForm must be one of/
    );
  });
});
