import fs from "node:fs";
import path from "node:path";

import {
  analyzeCursorAuditWords,
  loadCursorAuditPolicy,
  type CursorAuditPolicy
} from "./cursorAuditPolicy";

export const DEFAULT_CURSOR_CONSUMER_BENCHMARK_PATH = path.resolve(
  process.cwd(),
  "config",
  "cursor-consumer-benchmark.v1.json"
);

export type CursorConsumerBenchmarkCaseStatus = "stable" | "contaminated";

export type CursorConsumerBenchmarkCase = {
  id: string;
  token: string;
  isolated_text: string;
  surface: string;
  ref: string;
  word_index: number;
  status: CursorConsumerBenchmarkCaseStatus;
  include_in_stable_inference: boolean;
  roles: string[];
  contamination_reason?: string;
  notes?: string;
};

export type CursorConsumerBenchmark = {
  version: number;
  suite_name: string;
  policy_path: string;
  required_roles: string[];
  cases: CursorConsumerBenchmarkCase[];
};

function ensureString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`cursor consumer benchmark field ${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`cursor consumer benchmark field ${fieldName} must not be empty`);
  }
  return trimmed;
}

function ensureStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`cursor consumer benchmark field ${fieldName} must be a string[]`);
  }
  return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function ensurePositiveInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`cursor consumer benchmark field ${fieldName} must be a positive integer`);
  }
  return Number(value);
}

function ensureStatus(value: unknown, fieldName: string): CursorConsumerBenchmarkCaseStatus {
  if (value !== "stable" && value !== "contaminated") {
    throw new Error(
      `cursor consumer benchmark field ${fieldName} must be \"stable\" or \"contaminated\"`
    );
  }
  return value;
}

export function loadCursorConsumerBenchmark(
  benchmarkPath: string = DEFAULT_CURSOR_CONSUMER_BENCHMARK_PATH
): CursorConsumerBenchmark {
  const raw = fs.readFileSync(benchmarkPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const cases = Array.isArray(parsed.cases) ? parsed.cases : [];

  const benchmark: CursorConsumerBenchmark = {
    version: ensurePositiveInteger(parsed.version, "version"),
    suite_name: ensureString(parsed.suite_name, "suite_name"),
    policy_path: ensureString(parsed.policy_path, "policy_path"),
    required_roles: ensureStringArray(parsed.required_roles, "required_roles"),
    cases: cases.map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        throw new Error(`cursor consumer benchmark case ${index} must be an object`);
      }
      const record = entry as Record<string, unknown>;
      return {
        id: ensureString(record.id, `cases[${index}].id`),
        token: ensureString(record.token, `cases[${index}].token`),
        isolated_text: ensureString(record.isolated_text, `cases[${index}].isolated_text`),
        surface: ensureString(record.surface, `cases[${index}].surface`),
        ref: ensureString(record.ref, `cases[${index}].ref`),
        word_index: ensurePositiveInteger(record.word_index, `cases[${index}].word_index`),
        status: ensureStatus(record.status, `cases[${index}].status`),
        include_in_stable_inference: Boolean(record.include_in_stable_inference),
        roles: ensureStringArray(record.roles, `cases[${index}].roles`),
        contamination_reason:
          typeof record.contamination_reason === "string"
            ? record.contamination_reason.trim() || undefined
            : undefined,
        notes: typeof record.notes === "string" ? record.notes.trim() || undefined : undefined
      };
    })
  };

  const policyPath = path.resolve(process.cwd(), benchmark.policy_path);
  const policy = loadCursorAuditPolicy(policyPath);
  assertCursorConsumerBenchmarkConsistency(benchmark, policy);
  return benchmark;
}

export function assertCursorConsumerBenchmarkConsistency(
  benchmark: CursorConsumerBenchmark,
  policy: CursorAuditPolicy = loadCursorAuditPolicy()
): void {
  if (benchmark.cases.length === 0) {
    throw new Error("cursor consumer benchmark must contain at least one case");
  }

  const seenIds = new Set<string>();
  const roleCoverage = new Map<string, number>();

  for (const requiredRole of benchmark.required_roles) {
    roleCoverage.set(requiredRole, 0);
  }

  for (const entry of benchmark.cases) {
    if (seenIds.has(entry.id)) {
      throw new Error(`cursor consumer benchmark case id ${entry.id} is duplicated`);
    }
    seenIds.add(entry.id);

    if (entry.token !== entry.isolated_text) {
      throw new Error(
        `cursor consumer benchmark case ${entry.id} must keep isolated_text identical to token`
      );
    }

    if (entry.roles.length === 0) {
      throw new Error(`cursor consumer benchmark case ${entry.id} must declare at least one role`);
    }

    const analysis = analyzeCursorAuditWords([entry.token], policy);
    if (analysis.blockedWords.length > 0) {
      throw new Error(
        `cursor consumer benchmark case ${entry.id} is blocked by graph-incomplete glyphs`
      );
    }

    const isStableByPolicy = analysis.status === "stable-only";
    if (entry.status === "stable" && !isStableByPolicy) {
      throw new Error(
        `cursor consumer benchmark case ${entry.id} is marked stable but matches excluded glyphs`
      );
    }
    if (entry.status === "contaminated" && isStableByPolicy) {
      throw new Error(
        `cursor consumer benchmark case ${entry.id} is marked contaminated but is stable by policy`
      );
    }

    if (entry.status === "stable" && !entry.include_in_stable_inference) {
      throw new Error(
        `cursor consumer benchmark case ${entry.id} is stable and must stay in stable inference`
      );
    }
    if (entry.status === "contaminated" && entry.include_in_stable_inference) {
      throw new Error(
        `cursor consumer benchmark case ${entry.id} is contaminated and must stay out of stable inference`
      );
    }

    if (entry.status === "contaminated" && !entry.roles.includes("contamination_control")) {
      throw new Error(
        `cursor consumer benchmark case ${entry.id} must be flagged as a contamination_control`
      );
    }
    if (entry.status === "contaminated" && !entry.contamination_reason) {
      throw new Error(
        `cursor consumer benchmark case ${entry.id} must explain its contamination reason`
      );
    }

    for (const role of entry.roles) {
      if (roleCoverage.has(role)) {
        roleCoverage.set(role, (roleCoverage.get(role) ?? 0) + 1);
      }
    }
  }

  for (const [role, count] of roleCoverage) {
    if (count === 0) {
      throw new Error(`cursor consumer benchmark is missing required role ${role}`);
    }
  }
}

export function getStableCursorConsumerBenchmarkCases(
  benchmark: CursorConsumerBenchmark = loadCursorConsumerBenchmark()
): CursorConsumerBenchmarkCase[] {
  return benchmark.cases.filter(
    (entry) => entry.status === "stable" && entry.include_in_stable_inference
  );
}
