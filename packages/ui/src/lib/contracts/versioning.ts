import type { VersionContract } from './common';

export type VersionStatusLevel = 'ok' | 'warning' | 'error';

export type VersionStatus = {
  field: keyof VersionContract;
  value: string;
  level: VersionStatusLevel;
  message: string;
};

export const UI_BASELINE_VERSION_CONTRACT: VersionContract = {
  trace_version: '1.1.0',
  semantics_version: '1.1.0',
  render_version: '1.1.0'
};

type ParsedSemVer = {
  major: number;
  minor: number;
  patch: number;
};

function parseSemVer(value: string): ParsedSemVer {
  const match = String(value).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid semantic version '${value}'`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareSemVer(left: string, right: string): number {
  const l = parseSemVer(left);
  const r = parseSemVer(right);

  if (l.major !== r.major) {
    return l.major - r.major;
  }
  if (l.minor !== r.minor) {
    return l.minor - r.minor;
  }
  return l.patch - r.patch;
}

function classifyVersion(
  field: keyof VersionContract,
  value: string,
  baseline: string
): VersionStatus {
  const actual = parseSemVer(value);
  const expected = parseSemVer(baseline);

  if (actual.major !== expected.major) {
    return {
      field,
      value,
      level: 'error',
      message: `Major version mismatch (expected ${expected.major}.x.x)`
    };
  }

  const ordering = compareSemVer(value, baseline);
  if (ordering === 0) {
    return {
      field,
      value,
      level: 'ok',
      message: 'Matches UI baseline'
    };
  }

  if (ordering > 0) {
    return {
      field,
      value,
      level: 'warning',
      message: `Newer than UI baseline (${baseline})`
    };
  }

  return {
    field,
    value,
    level: 'warning',
    message: `Older than UI baseline (${baseline})`
  };
}

export function evaluateVersionContract(
  contract: VersionContract,
  baseline: VersionContract = UI_BASELINE_VERSION_CONTRACT
): VersionStatus[] {
  return [
    classifyVersion('trace_version', contract.trace_version, baseline.trace_version),
    classifyVersion('semantics_version', contract.semantics_version, baseline.semantics_version),
    classifyVersion('render_version', contract.render_version, baseline.render_version)
  ];
}

export function hasBlockingVersionIssue(statuses: VersionStatus[]): boolean {
  return statuses.some((status) => status.level === 'error');
}

export function formatVersionStatus(status: VersionStatus): string {
  return `${status.field}: ${status.value} (${status.message})`;
}
