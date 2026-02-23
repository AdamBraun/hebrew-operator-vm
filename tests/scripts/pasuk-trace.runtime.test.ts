import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseRefKey,
  runPasukTrace,
  main,
  PasukTraceOptions
} from "@ref/scripts/pasukTrace/runtime";

describe("pasuk trace runtime", () => {
  it("parses ref keys", () => {
    expect(parseRefKey("Genesis/1/2")).toEqual({ book: "Genesis", chapter: 1, verse: 2 });
    expect(() => parseRefKey("Genesis/1")).toThrow(/Invalid ref/);
  });

  it("runs deep trace for a selected pasuk and formats word sections", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-run-"));
    const inputPath = path.join(tmpDir, "torah.json");

    const payload = {
      books: [
        {
          name: "Genesis",
          chapters: [
            {
              n: 1,
              verses: [{ n: 2, he: "וְהָאָרֶץ הָיְתָה" }]
            }
          ]
        }
      ]
    };

    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), "utf8");

    const opts: PasukTraceOptions = {
      input: inputPath,
      ref: "Genesis/1/2",
      text: "",
      lang: "he",
      normalizeFinals: false,
      keepTeamim: false,
      allowRuntimeErrors: false,
      includeSnapshots: false,
      outJson: path.join(tmpDir, "out.json"),
      outReport: path.join(tmpDir, "out.txt"),
      printReport: false
    };

    const result = await runPasukTrace(opts);
    expect(result.ref_key).toBe("Genesis/1/2");
    expect(result.cleaned_text).toBe("וְהָאָרֶץ הָיְתָה");
    expect(result.word_sections.length).toBe(2);
    expect(result.report_text).toContain("WORD 1");
    expect(result.report_text).toContain("Select");
    expect(result.report_text).toContain("Rosh");
    expect(result.report_text).toContain("Toch");
    expect(
      result.trace.some((entry) => entry.phases.some((phase) => phase.phase === "select"))
    ).toBe(true);
    expect(Array.isArray(result.verse_snapshots)).toBe(true);
    expect(result.verse_snapshots.length).toBe(1);
    expect(typeof result.final_state.vm?.has_data_payload).toBe("boolean");
    expect(result.final_state.vm?.wordHasContent).toBeUndefined();
  });

  it("surfaces holam on rosh tier and marks hataf composites", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-rosh-"));
    const outJsonPath = path.join(tmpDir, "trace.json");
    const outReportPath = path.join(tmpDir, "trace.txt");

    const opts: PasukTraceOptions = {
      input: path.join(tmpDir, "unused.json"),
      ref: "Genesis/1/1",
      text: "הֹ אֱ",
      lang: "he",
      normalizeFinals: false,
      keepTeamim: false,
      allowRuntimeErrors: false,
      includeSnapshots: false,
      outJson: outJsonPath,
      outReport: outReportPath,
      printReport: false
    };

    const result = await runPasukTrace(opts);
    expect(result.report_text).toContain("rosh:holam");

    const holamEntry = result.trace.find((entry) => entry.token_raw === "הֹ");
    const holamRosh = holamEntry?.phases.find((phase) => phase.phase === "rosh")?.detail as
      | Record<string, any>
      | undefined;
    expect(Array.isArray(holamRosh?.rosh_diacritics)).toBe(true);
    expect(
      holamRosh?.rosh_diacritics?.some((item: { kind?: string }) => item.kind === "holam")
    ).toBe(true);

    const hatafEntry = result.trace.find((entry) => entry.token_raw === "אֱ");
    const hatafSof = hatafEntry?.phases.find((phase) => phase.phase === "sof")?.detail as
      | Record<string, any>
      | undefined;
    const hatafKinds = Array.isArray(hatafSof?.sof_diacritics)
      ? hatafSof.sof_diacritics.map(
          (item: { composite?: { kind?: string; role?: string } }) => item.composite?.kind
        )
      : [];
    expect(hatafKinds).toContain("hataf_segol");
    expect(
      hatafSof?.sof_diacritics?.every(
        (item: { composite?: { kind?: string; role?: string } }) =>
          item.composite?.kind === "hataf_segol"
      )
    ).toBe(true);
  });

  it("shows explicit join-in consumption at word entry", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-join-"));
    const outJsonPath = path.join(tmpDir, "trace.json");
    const outReportPath = path.join(tmpDir, "trace.txt");

    const opts: PasukTraceOptions = {
      input: path.join(tmpDir, "unused.json"),
      ref: "Genesis/1/1",
      text: "א־ב",
      lang: "he",
      normalizeFinals: false,
      keepTeamim: true,
      allowRuntimeErrors: false,
      includeSnapshots: false,
      outJson: outJsonPath,
      outReport: outReportPath,
      printReport: false
    };

    const result = await runPasukTrace(opts);
    expect(result.word_sections.length).toBe(2);
    expect(result.report_text).toContain("join_in: join:");
    expect(result.report_text).toContain("(consumed)");

    const secondWordEntry = result.word_sections[1]?.op_entries[0];
    const wordContext = secondWordEntry?.phases.find(
      (phase) => phase.phase === "word_entry_context"
    )?.detail as Record<string, any> | undefined;
    expect(wordContext?.pending_join_action).toBe("consumed");
    expect(typeof wordContext?.pending_join_at_entry?.id).toBe("string");
  });

  it("collects sequential verse snapshots when multiple sof pasuq markers are present", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-multi-verse-"));
    const outJsonPath = path.join(tmpDir, "trace.json");
    const outReportPath = path.join(tmpDir, "trace.txt");

    const opts: PasukTraceOptions = {
      input: path.join(tmpDir, "unused.json"),
      ref: "Genesis/1/1",
      text: "א׃ ב׃",
      lang: "he",
      normalizeFinals: false,
      keepTeamim: true,
      allowRuntimeErrors: false,
      includeSnapshots: false,
      outJson: outJsonPath,
      outReport: outReportPath,
      printReport: false
    };

    const result = await runPasukTrace(opts);
    expect(result.cleaned_text).toBe("א׃ ב׃");
    expect(result.verse_snapshots.length).toBe(2);
    expect(result.verse_snapshots[0].tau_end).toBe(4);
    expect(result.verse_snapshots[1].tau_end).toBe(3);
    expect(result.final_state.vm.tau).toBe(result.verse_snapshots[1].tau_end);
  });

  it("writes json and report outputs from main", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-main-"));
    const inputPath = path.join(tmpDir, "torah.json");
    const outJsonPath = path.join(tmpDir, "trace.json");
    const outReportPath = path.join(tmpDir, "trace.txt");

    const payload = {
      books: [
        {
          name: "Genesis",
          chapters: [
            {
              n: 1,
              verses: [{ n: 1, he: "א ב" }]
            }
          ]
        }
      ]
    };

    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), "utf8");

    await main([
      `--input=${inputPath}`,
      "--ref=Genesis/1/1",
      "--lang=he",
      "--no-snapshots",
      `--out-json=${outJsonPath}`,
      `--out-report=${outReportPath}`,
      "--no-print-report"
    ]);

    const jsonText = await fs.readFile(outJsonPath, "utf8");
    const reportText = await fs.readFile(outReportPath, "utf8");
    const parsed = JSON.parse(jsonText);

    expect(parsed.ref_key).toBe("Genesis/1/1");
    expect(Array.isArray(parsed.deep_trace)).toBe(true);
    expect(Array.isArray(parsed.verse_snapshots)).toBe(true);
    expect(reportText).toContain("PASUK TRACE REPORT");
  });
});
