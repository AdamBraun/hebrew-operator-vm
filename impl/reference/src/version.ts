export type SemVer = `${number}.${number}.${number}`;
export type TraceVersion = `1.${number}.${number}`;

export const TRACE_VERSION: TraceVersion = "1.1.0";
export const SEMANTICS_VERSION: SemVer = "1.1.0";
export const RENDER_VERSION: SemVer = "1.1.0";

export type VersionContract = {
  trace_version: TraceVersion;
  semantics_version: SemVer;
  render_version: SemVer;
};

export const VERSION_CONTRACT: VersionContract = Object.freeze({
  trace_version: TRACE_VERSION,
  semantics_version: SEMANTICS_VERSION,
  render_version: RENDER_VERSION
});
