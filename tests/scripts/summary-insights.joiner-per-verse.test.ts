import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadPerVersePayload,
  resolvePerVerseOutputPath
} from "@ref/scripts/summaryInsights/joiners/perVerse";

describe("summary insights per-verse joiner", () => {
  it("loads verseBoundary, traceMeta, and provenance from per-verse payload", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-insights-joiner-"));
    const payloadPath = path.join(tmpDir, "verse.json");
    fs.writeFileSync(
      payloadPath,
      JSON.stringify(
        {
          verseBoundary: {
            mode: "carry_omega_focus",
            end: { omega: "Ωv:Genesis_1_1" },
            startNext: { omega: "Ωv:Genesis_1_1" }
          },
          traceMeta: {
            source: "trace-v1"
          },
          provenance: {
            handles: {
              "pin:1": ["token:י"]
            }
          },
          trace: [{ index: 0, token: "י" }]
        },
        null,
        2
      ),
      "utf8"
    );

    const payload = await loadPerVersePayload(payloadPath, tmpDir);
    expect(payload.verseBoundary).toBeDefined();
    expect(payload.traceMeta).toEqual({ source: "trace-v1" });
    expect(payload.provenance).toEqual({
      handles: {
        "pin:1": ["token:י"]
      }
    });
  });

  it("resolves relative output path against workspace root", () => {
    const resolved = resolvePerVerseOutputPath("outputs/x/1.json", "/tmp/run-root");
    expect(resolved).toBe(path.resolve("/tmp/run-root/outputs/x/1.json"));
  });

  it("throws helpful errors for missing payload files", async () => {
    await expect(
      loadPerVersePayload("/tmp/does-not-exist/verse.json", process.cwd())
    ).rejects.toThrow(/Unable to read per-verse payload/);
  });
});
