import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(process.cwd(), "scripts", "exemplar-library.mjs");

type TraceRow = {
  ref: {
    book: string;
    chapter: number;
    verse: number;
    token_index: number;
  };
  ref_key: string;
  surface: string;
  token_ids: number[];
  skeleton: string[];
  flow: string;
  semantic_version?: string;
  semantics_version?: string;
};

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

function writeJson(pathName: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(pathName), { recursive: true });
  fs.writeFileSync(pathName, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function writeJsonl(pathName: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(pathName), { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  fs.writeFileSync(pathName, content, "utf8");
}

function skeletonKey(skeleton: string[]): string {
  return skeleton.join("|");
}

describe("exemplar library build + verify pipeline", () => {
  it("builds deterministic artifacts and verify catches regression mismatches", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "exemplar-library-test-"));
    const tracePath = path.join(tmpDir, "corpus", "word_traces.jsonl");
    const skeletonCountsPath = path.join(tmpDir, "index", "skeleton_counts.json");
    const motifIndexPath = path.join(tmpDir, "index", "motif_index.json");
    const exemplarsPath = path.join(tmpDir, "exemplars", "exemplars.json");
    const readmePath = path.join(tmpDir, "exemplars", "README.md");
    const regressionPath = path.join(tmpDir, "tests", "exemplar_regression.json");

    const rows: TraceRow[] = [
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
        ref_key: "Genesis/1/1/1",
        surface: "רֵאשִׁית",
        token_ids: [11, 12, 13],
        skeleton: ["RESH.BOUNDARY_CLOSE", "ALEPH.ALIAS", "SHIN.FORK", "TAV.FINALIZE"],
        flow: "ר boundary close ⇢ א alias ⇢ ש fork route ⇢ ת finalize+stamp",
        semantics_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 2 },
        ref_key: "Genesis/1/1/2",
        surface: "אֵת",
        token_ids: [21, 22],
        skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"],
        flow: "א alias ⇢ ת finalize+stamp",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 3 },
        ref_key: "Genesis/1/1/3",
        surface: "אֱלֹהִים",
        token_ids: [31, 32, 33],
        skeleton: ["ALEPH.ALIAS", "LAMED.ENDPOINT", "HE.DECLARE", "FINAL_MEM.CLOSE"],
        flow: "א alias ⇢ ל endpoint bind ⇢ ה declare(public) ⇢ ם close mem-zone",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 1 },
        ref_key: "Genesis/1/2/1",
        surface: "פְּנֵי",
        token_ids: [41, 42],
        skeleton: ["PE.UTTER", "NUN.SUPPORT_DEBT", "SPACE.SUPPORT_DISCHARGE"],
        flow: "פ utterance ⇢ נ support debt ⇢ □ boundary support discharge",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 2 },
        ref_key: "Genesis/1/2/2",
        surface: "מְרַחֶפֶת",
        token_ids: [51, 52, 53],
        skeleton: [
          "MEM.OPEN",
          "RESH.BOUNDARY_CLOSE",
          "HET.COMPARTMENT",
          "PE.UTTER",
          "TAV.FINALIZE",
          "SPACE.MEM_AUTO_CLOSE"
        ],
        flow: "מ open mem-zone ⇢ ר boundary close ⇢ ח compartment ⇢ פ utterance ⇢ ת finalize+stamp ⇢ □ mem auto-close",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 3 },
        ref_key: "Genesis/1/2/3",
        surface: "בֵּין",
        token_ids: [61, 62],
        skeleton: ["FINAL_NUN.SUPPORT_DEBT", "FINAL_NUN.SUPPORT_DISCHARGE"],
        flow: "ן support debt ⇢ ן same-word discharge",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 4 },
        ref_key: "Genesis/1/2/4",
        surface: "וְעוֹף",
        token_ids: [71],
        skeleton: ["FINAL_PE.UTTER_CLOSE"],
        flow: "ף close utterance",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 5 },
        ref_key: "Genesis/1/2/5",
        surface: "הָאָרֶץ",
        token_ids: [81, 82, 83],
        skeleton: ["HE.DECLARE", "ALEPH.ALIAS", "RESH.BOUNDARY_CLOSE", "FINAL_TSADI.ALIGN_FINAL"],
        flow: "ה declare(public) ⇢ א alias ⇢ ר boundary close ⇢ ץ final align",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 6 },
        ref_key: "Genesis/1/2/6",
        surface: "לְמִינָהּ",
        token_ids: [91, 92, 93],
        skeleton: [
          "LAMED.ENDPOINT",
          "MEM.OPEN",
          "NUN.SUPPORT_DEBT",
          "HE.DECLARE",
          "HE.DECLARE_PIN",
          "SPACE.SUPPORT_DISCHARGE",
          "SPACE.MEM_AUTO_CLOSE"
        ],
        flow: "ל endpoint bind ⇢ מ open mem-zone ⇢ נ support debt ⇢ ה declare(public) ⇢ ה pin export ⇢ □ boundary support discharge ⇢ □ mem auto-close",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 7 },
        ref_key: "Genesis/1/2/7",
        surface: "שִׂיחַ",
        token_ids: [101, 102],
        skeleton: ["HET.COMPARTMENT"],
        flow: "ח compartment",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 8 },
        ref_key: "Genesis/1/2/8",
        surface: "טוֹב",
        token_ids: [111],
        skeleton: ["TET.COVERT"],
        flow: "ט covert",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 9 },
        ref_key: "Genesis/1/2/9",
        surface: "וַיִּקְרָא",
        token_ids: [121, 122],
        skeleton: ["QOF.APPROX", "RESH.BOUNDARY_CLOSE", "ALEPH.ALIAS"],
        flow: "ק approximate ⇢ ר boundary close ⇢ א alias",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 10 },
        ref_key: "Genesis/1/2/10",
        surface: "וַתּוֹצֵא",
        token_ids: [131, 132],
        skeleton: ["TAV.FINALIZE", "TSADI.ALIGN", "ALEPH.ALIAS"],
        flow: "ת finalize+stamp ⇢ צ normalize-to-exemplar ⇢ א alias",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 11 },
        ref_key: "Genesis/1/2/11",
        surface: "וַיַּבְדֵּל",
        token_ids: [141, 142],
        skeleton: ["DALET.BOUNDARY_CLOSE", "LAMED.ENDPOINT"],
        flow: "ד boundary close ⇢ ל endpoint bind",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 12 },
        ref_key: "Genesis/1/2/12",
        surface: "הַגְּדֹלִים",
        token_ids: [151, 152],
        skeleton: [
          "HE.DECLARE",
          "GIMEL.BESTOW",
          "DALET.BOUNDARY_CLOSE",
          "LAMED.ENDPOINT",
          "FINAL_MEM.CLOSE"
        ],
        flow: "ה declare(public) ⇢ ג bestowal ⇢ ד boundary close ⇢ ל endpoint bind ⇢ ם close mem-zone",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 13 },
        ref_key: "Genesis/1/2/13",
        surface: "מַזְרִיעַ",
        token_ids: [161, 162],
        skeleton: ["MEM.OPEN", "ZAYIN.GATE", "RESH.BOUNDARY_CLOSE", "SPACE.MEM_AUTO_CLOSE"],
        flow: "מ open mem-zone ⇢ ז gate ⇢ ר boundary close ⇢ □ mem auto-close",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 14 },
        ref_key: "Genesis/1/2/14",
        surface: "לך",
        token_ids: [171],
        skeleton: ["LAMED.ENDPOINT"],
        flow: "ל endpoint bind",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 15 },
        ref_key: "Genesis/1/2/15",
        surface: "הָיְתָה",
        token_ids: [181],
        skeleton: ["HE.DECLARE", "TAV.FINALIZE", "HE.DECLARE_BREATH"],
        flow: "ה declare(public) ⇢ ת finalize+stamp ⇢ ה breath tail",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 16 },
        ref_key: "Genesis/1/2/16",
        surface: "מִנְּשֹׂא",
        token_ids: [191, 192],
        skeleton: ["MEM.OPEN", "NUN.SUPPORT_DEBT", "SAMEKH.SUPPORT_DISCHARGE", "ALEPH.ALIAS"],
        flow: "מ open mem-zone ⇢ נ support debt ⇢ ס support discharge ⇢ א alias",
        semantic_version: "1.0.0"
      }
    ];

    writeJsonl(tracePath, rows);

    const counts: Record<string, number> = {};
    for (const row of rows) {
      const key = skeletonKey(row.skeleton);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    writeJson(skeletonCountsPath, {
      schema_version: 1,
      skeleton_counts: counts
    });

    writeJson(motifIndexPath, {
      schema_version: 1,
      motifs: {
        ENDS_WITH_FINALIZE: {
          name: "ENDS_WITH_FINALIZE",
          matching_skeleton_keys: ["ALEPH.ALIAS|TAV.FINALIZE"]
        },
        CONTAINS_BESTOW_THEN_SEAL: {
          name: "CONTAINS_BESTOW_THEN_SEAL",
          matching_skeleton_keys: [
            "HE.DECLARE|GIMEL.BESTOW|DALET.BOUNDARY_CLOSE|LAMED.ENDPOINT|FINAL_MEM.CLOSE"
          ]
        }
      }
    });

    const buildOut = runNode([
      SCRIPT,
      "build",
      `--trace=${tracePath}`,
      `--skeleton-counts=${skeletonCountsPath}`,
      `--motif-index=${motifIndexPath}`,
      `--out=${exemplarsPath}`,
      `--readme-out=${readmePath}`,
      `--regression-out=${regressionPath}`,
      "--minimum=8",
      "--top-skeletons=6",
      "--motif-per-motif=1",
      "--regression-limit=6"
    ]);
    expect(buildOut).toContain("build: exemplars=");

    const exemplarJsonFirst = fs.readFileSync(exemplarsPath, "utf8");
    const readmeFirst = fs.readFileSync(readmePath, "utf8");
    const regressionFirst = fs.readFileSync(regressionPath, "utf8");

    const exemplarPayload = JSON.parse(exemplarJsonFirst);
    expect(Array.isArray(exemplarPayload.exemplars)).toBe(true);
    expect(exemplarPayload.exemplars.length).toBeGreaterThanOrEqual(8);
    expect(exemplarPayload.exemplars[0]).toMatchObject({
      id: expect.any(String),
      ref_key: expect.any(String),
      surface: expect.any(String),
      token_ids: expect.any(Array),
      skeleton: expect.any(Array),
      flow: expect.any(String),
      semantic_version: "1.0.0",
      explanation: expect.any(String),
      tags: expect.any(Array)
    });
    const tagSet = new Set<string>();
    for (const exemplar of exemplarPayload.exemplars) {
      for (const tag of exemplar.tags) {
        tagSet.add(String(tag));
      }
    }
    expect(tagSet.has("mark:mappiq")).toBe(true);
    expect(tagSet.has("boundary:mem_auto_close")).toBe(true);

    const regressionPayload = JSON.parse(regressionFirst);
    expect(regressionPayload.count).toBeGreaterThan(0);
    expect(Array.isArray(regressionPayload.cases)).toBe(true);
    expect(readmeFirst).toContain("## Exemplars");
    expect(readmeFirst).toContain("## Maintenance Rule");

    const rebuildOut = runNode([
      SCRIPT,
      "build",
      `--trace=${tracePath}`,
      `--skeleton-counts=${skeletonCountsPath}`,
      `--motif-index=${motifIndexPath}`,
      `--out=${exemplarsPath}`,
      `--readme-out=${readmePath}`,
      `--regression-out=${regressionPath}`,
      "--minimum=8",
      "--top-skeletons=6",
      "--motif-per-motif=1",
      "--regression-limit=6"
    ]);
    expect(rebuildOut).toContain("build: exemplars=");
    expect(fs.readFileSync(exemplarsPath, "utf8")).toBe(exemplarJsonFirst);
    expect(fs.readFileSync(readmePath, "utf8")).toBe(readmeFirst);
    expect(fs.readFileSync(regressionPath, "utf8")).toBe(regressionFirst);

    const verifyOut = runNode([
      SCRIPT,
      "verify",
      `--trace=${tracePath}`,
      `--skeleton-counts=${skeletonCountsPath}`,
      `--motif-index=${motifIndexPath}`,
      `--out=${exemplarsPath}`,
      `--readme-out=${readmePath}`,
      `--regression-out=${regressionPath}`,
      "--minimum=8",
      "--top-skeletons=6",
      "--motif-per-motif=1",
      "--regression-limit=6"
    ]);
    expect(verifyOut).toContain("verify: ok");

    const mutatedRegression = JSON.parse(fs.readFileSync(regressionPath, "utf8"));
    mutatedRegression.cases[0].expected_skeleton = ["BROKEN.EVENT"];
    writeJson(regressionPath, mutatedRegression);

    expect(() =>
      runNode([
        SCRIPT,
        "verify",
        `--trace=${tracePath}`,
        `--skeleton-counts=${skeletonCountsPath}`,
        `--motif-index=${motifIndexPath}`,
        `--out=${exemplarsPath}`,
        `--readme-out=${readmePath}`,
        `--regression-out=${regressionPath}`,
        "--minimum=8",
        "--top-skeletons=6",
        "--motif-per-motif=1",
        "--regression-limit=6"
      ])
    ).toThrow(/Regression case mismatch/);
  });
});
