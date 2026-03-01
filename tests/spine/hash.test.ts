import { describe, expect, it } from "vitest";
import { computeSpineDigest } from "../../src/spine/hash";
import { defaultNormalizationOptions } from "../../src/spine/options";

describe("spine digest", () => {
  const baseArgs = {
    inputSha256: "a".repeat(64),
    options: defaultNormalizationOptions(),
    codeFingerprint: "spine-module@1.0.0",
    schemaVersion: "1.0.0"
  };

  it("is deterministic for the same inputs", () => {
    const a = computeSpineDigest(baseArgs);
    const b = computeSpineDigest(baseArgs);
    expect(a).toBe(b);
  });

  it("changes when any option changes", () => {
    const baseline = computeSpineDigest(baseArgs);
    expect(
      computeSpineDigest({
        ...baseArgs,
        options: { ...baseArgs.options, unicodeForm: "NFKD" }
      })
    ).not.toBe(baseline);
    expect(
      computeSpineDigest({
        ...baseArgs,
        options: { ...baseArgs.options, normalizeFinals: true }
      })
    ).not.toBe(baseline);
    expect(
      computeSpineDigest({
        ...baseArgs,
        options: { ...baseArgs.options, stripControlChars: false }
      })
    ).not.toBe(baseline);
    expect(
      computeSpineDigest({
        ...baseArgs,
        options: { ...baseArgs.options, preservePunctuation: false }
      })
    ).not.toBe(baseline);
    expect(
      computeSpineDigest({
        ...baseArgs,
        options: { ...baseArgs.options, errorOnUnknownMark: true }
      })
    ).not.toBe(baseline);
  });

  it("changes when codeFingerprint changes", () => {
    const baseline = computeSpineDigest(baseArgs);
    const changed = computeSpineDigest({
      ...baseArgs,
      codeFingerprint: "spine-module@1.0.1"
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when inputSha256 changes", () => {
    const baseline = computeSpineDigest(baseArgs);
    const changed = computeSpineDigest({
      ...baseArgs,
      inputSha256: "b".repeat(64)
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when schemaVersion changes", () => {
    const baseline = computeSpineDigest(baseArgs);
    const changed = computeSpineDigest({
      ...baseArgs,
      schemaVersion: "2.0.0"
    });
    expect(changed).not.toBe(baseline);
  });

  it("uses stable key ordering for option objects", () => {
    const ordered = {
      unicodeForm: "NFC",
      normalizeFinals: false,
      stripControlChars: true,
      preservePunctuation: true,
      errorOnUnknownMark: false
    };
    const reordered = {
      errorOnUnknownMark: false,
      preservePunctuation: true,
      stripControlChars: true,
      normalizeFinals: false,
      unicodeForm: "NFC"
    };
    const a = computeSpineDigest({
      ...baseArgs,
      options: ordered
    });
    const b = computeSpineDigest({
      ...baseArgs,
      options: reordered
    });
    expect(a).toBe(b);
  });

  it("rejects invalid hash inputs", () => {
    expect(() =>
      computeSpineDigest({
        ...baseArgs,
        inputSha256: "XYZ"
      })
    ).toThrow(/inputSha256/);
    expect(() =>
      computeSpineDigest({
        ...baseArgs,
        codeFingerprint: ""
      })
    ).toThrow(/codeFingerprint/);
    expect(() =>
      computeSpineDigest({
        ...baseArgs,
        schemaVersion: ""
      })
    ).toThrow(/schemaVersion/);
  });
});
