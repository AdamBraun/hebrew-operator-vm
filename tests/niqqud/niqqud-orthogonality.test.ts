import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const IMPORT_RE =
  /\bfrom\s+["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)|\bimport\(\s*["']([^"']+)["']\s*\)/g;
const FORBIDDEN_LAYER_RE = /(^|\/)(letters|cantillation)(\/|$)/;

function collectModuleSpecifiers(source: string): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null = IMPORT_RE.exec(source);
  while (match) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) {
      out.push(specifier);
    }
    match = IMPORT_RE.exec(source);
  }
  return out;
}

function listNiqqudSourceFiles(): string[] {
  const niqqudDir = path.resolve(process.cwd(), "src", "layers", "niqqud");
  const niqqudFiles = fs
    .readdirSync(niqqudDir)
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => path.join(niqqudDir, entry));

  return [path.resolve(process.cwd(), "src", "cli", "build-layer-niqqud.ts"), ...niqqudFiles];
}

describe("niqqud orthogonality", () => {
  it("does not import letters/cantillation modules", () => {
    const offenders: Array<{ file: string; specifier: string }> = [];

    for (const filePath of listNiqqudSourceFiles()) {
      const source = fs.readFileSync(filePath, "utf8");
      const specifiers = collectModuleSpecifiers(source);
      for (const specifier of specifiers) {
        if (FORBIDDEN_LAYER_RE.test(specifier)) {
          offenders.push({ file: filePath, specifier });
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
