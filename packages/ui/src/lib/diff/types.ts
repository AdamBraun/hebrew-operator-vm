import type { RenderOutputRecord } from '../contracts';
import type { BundleManifest, RefsIndex, VerseBundle } from '../data/loader';

export type ParaphraseStyle = 'strict' | 'poetic';

export interface DiffBundleSnapshot {
  tag: string;
  manifest: BundleManifest;
  refsIndex: RefsIndex;
}

export interface VerseChangeSummary {
  refKey: string;
  score: number;
  paraphraseChanged: boolean;
  skeletonChanged: boolean;
  phraseTreeChanged: boolean;
  reasons: string[];
}

export interface BundleDiffIndexResult {
  totalVerses: number;
  changedVerses: VerseChangeSummary[];
}

export interface TextDiffSegment {
  type: 'same' | 'added' | 'removed';
  text: string;
}

export interface SideBySideTextDiff {
  changed: boolean;
  leftSegments: TextDiffSegment[];
  rightSegments: TextDiffSegment[];
}

export interface LedgerPointer {
  kind: 'verse' | 'word' | 'trace';
  refKey: string;
  eventStart: number | null;
  eventEnd: number | null;
}

export interface LedgerAnchor {
  style: ParaphraseStyle;
  anchorId: string;
  refKey: string;
  pointers: LedgerPointer[];
}

export interface LedgerAnchorDiff {
  style: ParaphraseStyle;
  anchorId: string;
  leftPointers: string[];
  rightPointers: string[];
  addedPointers: string[];
  removedPointers: string[];
  linkedWordIndex: number | null;
  linkedSkeletonChanged: boolean;
}

export interface PhraseTreeSummary {
  phraseVersion: string;
  rootId: string;
  wordCount: number;
  nodeCount: number;
  splitCount: number;
  joinCount: number;
  leafCount: number;
}

export interface PhraseTreeSummaryDiff {
  left: PhraseTreeSummary | null;
  right: PhraseTreeSummary | null;
  changed: boolean;
}

export interface WordSkeletonDiff {
  wordIndex: number;
  leftSurface: string | null;
  rightSurface: string | null;
  leftSkeleton: string[];
  rightSkeleton: string[];
  leftCanonicalHash: string | null;
  rightCanonicalHash: string | null;
}

export interface ParaphraseRecordDiff {
  style: ParaphraseStyle;
  leftText: string | null;
  rightText: string | null;
  textDiff: SideBySideTextDiff;
  changed: boolean;
}

export interface VerseDiffInputSide {
  verseBundle: VerseBundle | null;
  paraphraseRecords: RenderOutputRecord[];
}

export interface VerseDiffResult {
  refKey: string | null;
  paraphraseDiffs: ParaphraseRecordDiff[];
  ledgerAnchorDiffs: LedgerAnchorDiff[];
  wordSkeletonDiffs: WordSkeletonDiff[];
  phraseTreeDiff: PhraseTreeSummaryDiff;
  hasChanges: boolean;
}
