import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stitchProgramRowsFromFiles } from "../../src/wrapper/stitch/stitch";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "stitcher", "tiny");

function fixturePath(fileName: string): string {
  return path.join(FIXTURE_DIR, fileName);
}

function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readJsonlRows(filePath: string): Record<string, unknown>[] {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) {
    return [];
  }
  return text.split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
}

function writeJsonl(filePath: string, rows: readonly unknown[]): void {
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(filePath, `${text}\n`, "utf8");
}

function copyFixtureFileToTmp(tmpDir: string, fileName: string): string {
  const target = path.join(tmpDir, fileName);
  fs.copyFileSync(fixturePath(fileName), target);
  return target;
}

function buildInputPaths(tmpDir: string): {
  spinePath: string;
  lettersIrPath: string;
  niqqudIrPath: string;
  cantillationIrPath: string;
  layoutIrPath: string;
  metadataPlanPath: string;
} {
  return {
    spinePath: copyFixtureFileToTmp(tmpDir, "Spine.jsonl"),
    lettersIrPath: copyFixtureFileToTmp(tmpDir, "LettersIR.jsonl"),
    niqqudIrPath: copyFixtureFileToTmp(tmpDir, "NiqqudIR.jsonl"),
    cantillationIrPath: copyFixtureFileToTmp(tmpDir, "CantillationIR.jsonl"),
    layoutIrPath: copyFixtureFileToTmp(tmpDir, "LayoutIR.jsonl"),
    metadataPlanPath: copyFixtureFileToTmp(tmpDir, "MetadataPlan.json")
  };
}

describe("stitch contract no-bleeding checks", () => {
  it("rejects LettersIR contaminated with niqqud/cantillation fields", async () => {
    const tmp = makeTmpDir("stitch-contract-letters-");
    const paths = buildInputPaths(tmp);
    const letters = readJsonlRows(paths.lettersIrPath);
    const first = letters[0] ?? {};
    const features =
      typeof first.features === "object" &&
      first.features !== null &&
      !Array.isArray(first.features)
        ? (first.features as Record<string, unknown>)
        : {};
    first.features = {
      ...features,
      niqqud_class: "PATAH"
    };
    letters[0] = first;
    writeJsonl(paths.lettersIrPath, letters);

    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/LettersIR contamination/);
    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/niqqud_class/);
  });

  it("rejects NiqqudIR contaminated with letter classification fields", async () => {
    const tmp = makeTmpDir("stitch-contract-niqqud-");
    const paths = buildInputPaths(tmp);
    const niqqud = readJsonlRows(paths.niqqudIrPath);
    const first = niqqud[0] ?? {};
    const mods =
      typeof first.mods === "object" && first.mods !== null && !Array.isArray(first.mods)
        ? (first.mods as Record<string, unknown>)
        : {};
    const features =
      typeof mods.features === "object" && mods.features !== null && !Array.isArray(mods.features)
        ? (mods.features as Record<string, unknown>)
        : {};
    first.mods = {
      ...mods,
      features: {
        ...features,
        letter_op: "ALEPH"
      }
    };
    niqqud[0] = first;
    writeJsonl(paths.niqqudIrPath, niqqud);

    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/NiqqudIR contamination/);
    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/letter_op/);
  });

  it("rejects CantillationIR contaminated with layout event tokens", async () => {
    const tmp = makeTmpDir("stitch-contract-cant-");
    const paths = buildInputPaths(tmp);
    const cant = readJsonlRows(paths.cantillationIrPath);
    const second = cant[1] ?? {};
    const event =
      typeof second.event === "object" && second.event !== null && !Array.isArray(second.event)
        ? (second.event as Record<string, unknown>)
        : {};
    second.event = {
      ...event,
      reason: "SETUMA"
    };
    cant[1] = second;
    writeJsonl(paths.cantillationIrPath, cant);

    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/CantillationIR contamination/);
    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/SETUMA/);
  });

  it("rejects LayoutIR contaminated with cantillation tokens", async () => {
    const tmp = makeTmpDir("stitch-contract-layout-");
    const paths = buildInputPaths(tmp);
    const layout = readJsonlRows(paths.layoutIrPath);
    const first = layout[0] ?? {};
    const layoutEvent =
      typeof first.layout_event === "object" &&
      first.layout_event !== null &&
      !Array.isArray(first.layout_event)
        ? (first.layout_event as Record<string, unknown>)
        : {};
    const meta =
      typeof layoutEvent.meta === "object" &&
      layoutEvent.meta !== null &&
      !Array.isArray(layoutEvent.meta)
        ? (layoutEvent.meta as Record<string, unknown>)
        : {};
    first.layout_event = {
      ...layoutEvent,
      meta: {
        ...meta,
        boundary_op: "CUT"
      }
    };
    layout[0] = first;
    writeJsonl(paths.layoutIrPath, layout);

    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/LayoutIR contamination/);
    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/CUT/);
  });

  it("rejects ProgramIR rows contaminated with runtime handle/link state", async () => {
    const tmp = makeTmpDir("stitch-contract-program-");
    const paths = buildInputPaths(tmp);
    const layout = readJsonlRows(paths.layoutIrPath);
    const first = layout[0] ?? {};
    const layoutEvent =
      typeof first.layout_event === "object" &&
      first.layout_event !== null &&
      !Array.isArray(first.layout_event)
        ? (first.layout_event as Record<string, unknown>)
        : {};
    first.layout_event = {
      ...layoutEvent,
      meta: {
        handles: ["h7"]
      }
    };
    layout[0] = first;
    writeJsonl(paths.layoutIrPath, layout);

    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(
      /ProgramIR runtime-state contamination/
    );
    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/handles/);
  });
});
