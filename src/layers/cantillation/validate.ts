import { type CantillationIRRecord } from "./schema";

export type CantillationSpineAnchorRow =
  | {
      kind: "g";
      gid: string;
      ref_key: string;
    }
  | {
      kind: "gap";
      gapid: string;
      ref_key: string;
    };

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`cantillation validate: ${label} must be non-empty string`);
  }
}

function eventPayloadText(record: CantillationIRRecord): string {
  return JSON.stringify(record.event);
}

function missingAnchorError(record: CantillationIRRecord): Error {
  return new Error(
    `cantillation validate: missing Spine anchor for event ` +
      `ref_key='${record.ref_key}' anchor='${record.anchor.id}' kind='${record.anchor.kind}' ` +
      `event=${eventPayloadText(record)}`
  );
}

export class CantillationAnchorValidator {
  private currentRefKey: string | null = null;

  private gids = new Set<string>();

  private gapids = new Set<string>();

  registerSpineAnchor(row: CantillationSpineAnchorRow): void {
    assertNonEmptyString(row.ref_key, "row.ref_key");
    if (this.currentRefKey === null || this.currentRefKey !== row.ref_key) {
      this.currentRefKey = row.ref_key;
      this.gids = new Set<string>();
      this.gapids = new Set<string>();
    }

    if (row.kind === "g") {
      assertNonEmptyString(row.gid, "row.gid");
      this.gids.add(row.gid);
      return;
    }

    assertNonEmptyString(row.gapid, "row.gapid");
    this.gapids.add(row.gapid);
  }

  assertEventAnchorExists(record: CantillationIRRecord): void {
    assertNonEmptyString(record.ref_key, "record.ref_key");
    assertNonEmptyString(record.anchor.id, "record.anchor.id");

    if (this.currentRefKey === null) {
      throw missingAnchorError(record);
    }

    if (record.ref_key !== this.currentRefKey) {
      throw new Error(
        `cantillation validate: event ref_key='${record.ref_key}' ` +
          `does not match active ref_key='${this.currentRefKey}' for anchor='${record.anchor.id}' ` +
          `event=${eventPayloadText(record)}`
      );
    }

    const exists =
      record.anchor.kind === "gid"
        ? this.gids.has(record.anchor.id)
        : this.gapids.has(record.anchor.id);
    if (!exists) {
      throw missingAnchorError(record);
    }
  }
}
