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

function eventDataContainsHandleId(value: unknown, handleId: string): boolean {
  if (value === handleId) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => eventDataContainsHandleId(entry, handleId));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.values(value).some((entry) => eventDataContainsHandleId(entry, handleId));
}

function valueContainsHandleId(value: unknown, handleId: string): boolean {
  if (value === handleId) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => valueContainsHandleId(entry, handleId));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.values(value).some((entry) => valueContainsHandleId(entry, handleId));
}

function eventIndicesContainingHandleId(
  events: Array<Record<string, any>>,
  handleId: string
): number[] {
  const indices: number[] = [];
  for (const [index, event] of events.entries()) {
    if (valueContainsHandleId(event, handleId)) {
      indices.push(index);
    }
  }
  return indices;
}

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
    expect(result.report_text).toContain("incoming_D=");
    expect(result.report_text).toContain("incoming_F=");
    expect(result.report_text).toContain("outgoing_D=");
    expect(result.report_text).toContain("outgoing_F=");
    expect(result.report_text).toContain("exit_kind=");
    expect(result.report_text).toContain("Select");
    expect(result.report_text).toContain("Rosh");
    expect(result.report_text).toContain("Toch");
    expect(
      result.trace.some((entry) => entry.phases.some((phase) => phase.phase === "select"))
    ).toBe(true);
    expect(Array.isArray(result.verse_snapshots)).toBe(true);
    expect(result.verse_snapshots.length).toBe(1);
    expect(result.report_text).toContain("FINAL DUMP STATE");
    expect(result.report_text).toContain("POST-RESET RUNTIME STATE");
    expect(result.report_text).toContain("vm.D=");
    expect(result.report_text).toContain("vm.F=");
    expect(result.report_text).toContain("vm.OmegaId=");
    expect(result.final_state).toEqual(result.final_dump_state);
    expect(
      (result.post_reset_state.handles as Array<{ id?: string }>).map((handle) => handle.id).sort()
    ).toEqual(["Ω", "⊥"].sort());
    expect(typeof result.final_state.vm?.has_data_payload).toBe("boolean");
    expect(result.final_state.vm?.D).toBeDefined();
    expect(result.final_state.vm?.Omega).toBeUndefined();
    expect(result.final_state.vm?.OmegaId).toBe("Ω");
    expect(result.post_reset_state.vm?.D).toBe("Ω");
    expect(result.post_reset_state.vm?.F).toBe("Ω");
    expect(result.post_reset_state.vm?.Omega).toBeUndefined();
    expect(result.post_reset_state.vm?.OmegaId).toBe("Ω");
    expect(result.final_state.vm?.wordHasContent).toBeUndefined();
    expect(result.word_sections[0]?.incoming_D).toBe("Ω");
    expect(result.word_sections[0]?.incoming_F).toBe("Ω");
    expect(typeof result.word_sections[0]?.outgoing_D).toBe("string");
    expect(typeof result.word_sections[0]?.outgoing_F).toBe("string");
    expect(["cut", "glue", "glue_maqqef"]).toContain(result.word_sections[0]?.exit_kind);
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

  it("keeps each final boundary handle trace-addressable via vm.H data refs", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-boundary-refs-"));
    const outJsonPath = path.join(tmpDir, "trace.json");
    const outReportPath = path.join(tmpDir, "trace.txt");

    const opts: PasukTraceOptions = {
      input: path.join(tmpDir, "unused.json"),
      ref: "Genesis/1/1",
      text: "אבי",
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
    const boundaryHandleIds = Array.isArray(result.final_state?.handles)
      ? result.final_state.handles
          .filter((handle: { kind?: string; id?: string }) => handle.kind === "boundary")
          .map((handle: { id?: string }) => handle.id)
          .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    expect(boundaryHandleIds.length).toBeGreaterThan(0);

    const vmEvents = Array.isArray(result.final_state?.vm?.H) ? result.final_state.vm.H : [];
    const missing = boundaryHandleIds.filter(
      (handleId) =>
        !vmEvents.some((event: { data?: unknown }) =>
          eventDataContainsHandleId(event?.data, handleId)
        )
    );
    expect(missing).toEqual([]);
  });

  it("emits deterministic handle link_index entries for final handles", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-link-index-"));
    const outJsonPath = path.join(tmpDir, "trace.json");
    const outReportPath = path.join(tmpDir, "trace.txt");

    const opts: PasukTraceOptions = {
      input: path.join(tmpDir, "unused.json"),
      ref: "Genesis/1/1",
      text: "וְאִם יִוָּתֵר",
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
    const handles = Array.isArray(result.final_state?.handles)
      ? (result.final_state.handles as Array<{ id?: string; meta?: Record<string, any> }>)
      : [];
    const handleIds = handles
      .map((handle) => handle.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const vmEvents = Array.isArray(result.final_state?.vm?.H)
      ? (result.final_state.vm.H as Array<Record<string, any>>)
      : [];

    const linkIndex = Array.isArray(result.link_index)
      ? (result.link_index as Array<{
          handle_id?: string;
          event_indices?: number[];
          taus?: number[];
        }>)
      : [];
    const linkByHandle = new Map(
      linkIndex
        .filter(
          (row): row is { handle_id: string; event_indices: number[]; taus: number[] } =>
            typeof row?.handle_id === "string" &&
            Array.isArray(row?.event_indices) &&
            Array.isArray(row?.taus)
        )
        .map((row) => [row.handle_id, row])
    );

    expect(linkByHandle.size).toBe(handleIds.length);
    for (const handleId of handleIds) {
      const entry = linkByHandle.get(handleId);
      expect(entry).toBeDefined();
      expect(entry?.event_indices.length).toBeGreaterThan(0);
      for (const eventIndex of entry?.event_indices ?? []) {
        expect(Number.isInteger(eventIndex)).toBe(true);
        expect(eventIndex).toBeGreaterThanOrEqual(0);
        expect(eventIndex).toBeLessThan(vmEvents.length);
      }
      const expectedTaus = Array.from(
        new Set(
          (entry?.event_indices ?? [])
            .map((eventIndex) => vmEvents[eventIndex]?.tau)
            .filter((tau): tau is number => Number.isInteger(tau) && tau >= 0)
        )
      ).sort((left, right) => left - right);
      expect(entry?.taus).toEqual(expectedTaus);
    }

    const seededHandle = handles.find(
      (handle) =>
        typeof handle.id === "string" &&
        typeof handle.meta?.seedOf === "string" &&
        eventIndicesContainingHandleId(vmEvents, handle.meta.seedOf).length > 0
    );
    expect(seededHandle).toBeDefined();
    const seededHandleId = String(seededHandle?.id ?? "");
    const seedOf = String(seededHandle?.meta?.seedOf ?? "");
    const seedEventIndices = eventIndicesContainingHandleId(vmEvents, seedOf);
    expect(seedEventIndices.length).toBeGreaterThan(0);
    const seededEntry = linkByHandle.get(seededHandleId);
    expect(
      (seededEntry?.event_indices ?? []).some((eventIndex) => seedEventIndices.includes(eventIndex))
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
    expect(result.word_sections[0]?.exit_kind).toBe("glue_maqqef");
    expect(result.word_sections[1]?.incoming_F).toBe(result.word_sections[0]?.outgoing_F);

    const secondWordEntry = result.word_sections[1]?.op_entries[0];
    const wordContext = secondWordEntry?.phases.find(
      (phase) => phase.phase === "word_entry_context"
    )?.detail as Record<string, any> | undefined;
    expect(wordContext?.pending_join_action).toBe("consumed");
    expect(typeof wordContext?.pending_join_at_entry?.id).toBe("string");
  });

  it("cut boundaries reset next-word focus to the next-word domain", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-cut-focus-reset-"));
    const outJsonPath = path.join(tmpDir, "trace.json");
    const outReportPath = path.join(tmpDir, "trace.txt");

    const opts: PasukTraceOptions = {
      input: path.join(tmpDir, "unused.json"),
      ref: "Genesis/1/1",
      text: "א֑ ב",
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
    expect(result.word_sections[0]?.exit_kind).toBe("cut");
    expect(result.word_sections[1]?.incoming_F).toBe(result.word_sections[1]?.incoming_D);
  });

  it("keeps D immutable across operator steps within each word", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-domain-stability-"));
    const outJsonPath = path.join(tmpDir, "trace.json");
    const outReportPath = path.join(tmpDir, "trace.txt");

    const opts: PasukTraceOptions = {
      input: path.join(tmpDir, "unused.json"),
      ref: "Genesis/1/1",
      text: "אב גדה",
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
    expect(result.word_sections.length).toBe(2);

    for (const section of result.word_sections) {
      const [firstEntry] = section.op_entries;
      expect(firstEntry).toBeDefined();
      expect(section.incoming_D).toBe(firstEntry?.D);
      for (const entry of section.op_entries) {
        expect(entry.D).toBe(firstEntry?.D);
      }
    }
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
    expect(result.post_reset_state.vm.tau).toBe(0);
    expect(
      (result.post_reset_state.handles as Array<{ id?: string }>).map((handle) => handle.id).sort()
    ).toEqual(["Ω", "⊥"].sort());
  });

  it("supports hiding post-reset section in the report", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-hide-post-reset-"));
    const outJsonPath = path.join(tmpDir, "trace.json");
    const outReportPath = path.join(tmpDir, "trace.txt");

    const opts: PasukTraceOptions = {
      input: path.join(tmpDir, "unused.json"),
      ref: "Genesis/1/1",
      text: "א׃",
      lang: "he",
      normalizeFinals: false,
      keepTeamim: true,
      allowRuntimeErrors: false,
      includeSnapshots: false,
      showPostReset: false,
      outJson: outJsonPath,
      outReport: outReportPath,
      printReport: false
    };

    const result = await runPasukTrace(opts);
    expect(result.report_text).toContain("FINAL DUMP STATE");
    expect(result.report_text.includes("POST-RESET RUNTIME STATE")).toBe(false);
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

    expect(parsed.schema_version).toBe(2);
    expect(parsed.ref_key).toBe("Genesis/1/1");
    expect(Array.isArray(parsed.deep_trace)).toBe(true);
    expect(Array.isArray(parsed.verse_snapshots)).toBe(true);
    expect(Array.isArray(parsed.link_index)).toBe(true);
    expect(parsed.options.show_post_reset).toBe(true);
    expect(parsed.final_dump_state).toEqual(parsed.final_state);
    expect(Array.isArray(parsed.post_reset_state.handles)).toBe(true);
    expect(
      parsed.post_reset_state.handles.map((handle: { id?: string }) => handle.id).sort()
    ).toEqual(["Ω", "⊥"].sort());
    expect(reportText).toContain("PASUK TRACE REPORT");
    expect(reportText).toContain("FINAL DUMP STATE");
    expect(reportText).toContain("POST-RESET RUNTIME STATE");
  });
});
