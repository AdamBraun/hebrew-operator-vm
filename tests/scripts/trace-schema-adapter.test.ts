import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

let getSemanticVersion: (row: unknown, fallback?: string) => string;

beforeAll(async () => {
  const adapterPath = path.resolve(process.cwd(), "scripts", "lib", "trace-schema-adapter.cjs");
  const adapterModule = await import(pathToFileURL(adapterPath).href);
  const adapter = (adapterModule.default ?? adapterModule) as {
    getSemanticVersion: typeof getSemanticVersion;
  };
  getSemanticVersion = adapter.getSemanticVersion;
});

describe("trace schema adapter", () => {
  it("reads canonical semantics_version", () => {
    expect(getSemanticVersion({ semantics_version: "1.2.3" })).toBe("1.2.3");
  });

  it("reads legacy semantic_version", () => {
    expect(getSemanticVersion({ semantic_version: "1.2.3" })).toBe("1.2.3");
  });

  it("prefers semantics_version when both exist", () => {
    expect(
      getSemanticVersion({
        semantics_version: "2.0.0",
        semantic_version: "1.9.9"
      })
    ).toBe("2.0.0");
  });

  it("falls back to unknown when no version field exists", () => {
    expect(getSemanticVersion({})).toBe("unknown");
    expect(getSemanticVersion(null, "n/a")).toBe("n/a");
  });
});
