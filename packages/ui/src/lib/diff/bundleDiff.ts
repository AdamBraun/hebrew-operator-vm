import type { DiffBundleSnapshot, BundleDiffIndexResult, VerseChangeSummary } from './types';

export function computeBundleDiffIndex(
  leftBundle: DiffBundleSnapshot,
  rightBundle: DiffBundleSnapshot
): BundleDiffIndexResult {
  const allRefKeys = collectVerseRefKeys(leftBundle, rightBundle);
  const leftShaByPath = buildShaLookup(leftBundle.manifest.files);
  const rightShaByPath = buildShaLookup(rightBundle.manifest.files);
  const bookOrder = buildBookOrder(leftBundle, rightBundle);

  const changedVerses: VerseChangeSummary[] = [];
  for (const refKey of allRefKeys) {
    const paraphraseChanged = chunkFingerprint(
      leftBundle.refsIndex.paraphrase[refKey],
      leftShaByPath
    ) !== chunkFingerprint(rightBundle.refsIndex.paraphrase[refKey], rightShaByPath);
    const skeletonChanged =
      chunkFingerprint(leftBundle.refsIndex.roles[refKey], leftShaByPath) !==
      chunkFingerprint(rightBundle.refsIndex.roles[refKey], rightShaByPath);
    const phraseTreeChanged =
      chunkFingerprint(leftBundle.refsIndex.verses[refKey], leftShaByPath) !==
      chunkFingerprint(rightBundle.refsIndex.verses[refKey], rightShaByPath);

    if (!paraphraseChanged && !skeletonChanged && !phraseTreeChanged) {
      continue;
    }

    const reasons = [];
    if (paraphraseChanged) {
      reasons.push('paraphrase');
    }
    if (skeletonChanged) {
      reasons.push('skeleton');
    }
    if (phraseTreeChanged) {
      reasons.push('phrase tree');
    }

    changedVerses.push({
      refKey,
      score: computeScore(paraphraseChanged, skeletonChanged, phraseTreeChanged),
      paraphraseChanged,
      skeletonChanged,
      phraseTreeChanged,
      reasons
    });
  }

  changedVerses.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return compareVerseRefKeys(left.refKey, right.refKey, bookOrder);
  });

  return {
    totalVerses: allRefKeys.length,
    changedVerses
  };
}

function collectVerseRefKeys(leftBundle: DiffBundleSnapshot, rightBundle: DiffBundleSnapshot): string[] {
  const refs = new Set<string>();

  addObjectKeys(refs, leftBundle.refsIndex.verses);
  addObjectKeys(refs, leftBundle.refsIndex.roles);
  addObjectKeys(refs, leftBundle.refsIndex.paraphrase);

  addObjectKeys(refs, rightBundle.refsIndex.verses);
  addObjectKeys(refs, rightBundle.refsIndex.roles);
  addObjectKeys(refs, rightBundle.refsIndex.paraphrase);

  const ordered = Array.from(refs.values());
  const bookOrder = buildBookOrder(leftBundle, rightBundle);
  ordered.sort((left, right) => compareVerseRefKeys(left, right, bookOrder));
  return ordered;
}

function addObjectKeys(target: Set<string>, source: Record<string, string>): void {
  for (const key of Object.keys(source)) {
    target.add(key);
  }
}

function buildShaLookup(
  files: Array<{ path: string; sha256: string }>
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const entry of files) {
    lookup.set(entry.path, entry.sha256);
  }
  return lookup;
}

function chunkFingerprint(path: string | undefined, shaLookup: Map<string, string>): string | null {
  if (!path) {
    return null;
  }
  return `${path}|${shaLookup.get(path) ?? 'missing'}`;
}

function computeScore(
  paraphraseChanged: boolean,
  skeletonChanged: boolean,
  phraseTreeChanged: boolean
): number {
  let score = 0;
  if (paraphraseChanged) {
    score += 5;
  }
  if (skeletonChanged) {
    score += 3;
  }
  if (phraseTreeChanged) {
    score += 2;
  }
  return score;
}

function buildBookOrder(
  leftBundle: DiffBundleSnapshot,
  rightBundle: DiffBundleSnapshot
): Map<string, number> {
  const order = new Map<string, number>();
  let next = 0;

  for (const book of leftBundle.manifest.navigation.books) {
    if (!order.has(book.book)) {
      order.set(book.book, next);
      next += 1;
    }
  }

  for (const book of rightBundle.manifest.navigation.books) {
    if (!order.has(book.book)) {
      order.set(book.book, next);
      next += 1;
    }
  }

  return order;
}

function compareVerseRefKeys(leftRefKey: string, rightRefKey: string, bookOrder: Map<string, number>): number {
  const leftParsed = parseVerseRefKey(leftRefKey);
  const rightParsed = parseVerseRefKey(rightRefKey);

  if (!leftParsed || !rightParsed) {
    return leftRefKey.localeCompare(rightRefKey);
  }

  const leftOrder = bookOrder.get(leftParsed.book);
  const rightOrder = bookOrder.get(rightParsed.book);
  if (leftOrder !== undefined || rightOrder !== undefined) {
    if (leftOrder === undefined) {
      return 1;
    }
    if (rightOrder === undefined) {
      return -1;
    }
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
  } else {
    const bookCompare = leftParsed.book.localeCompare(rightParsed.book);
    if (bookCompare !== 0) {
      return bookCompare;
    }
  }

  if (leftParsed.chapter !== rightParsed.chapter) {
    return leftParsed.chapter - rightParsed.chapter;
  }

  if (leftParsed.verse !== rightParsed.verse) {
    return leftParsed.verse - rightParsed.verse;
  }

  return leftRefKey.localeCompare(rightRefKey);
}

function parseVerseRefKey(refKey: string): { book: string; chapter: number; verse: number } | null {
  const parts = String(refKey).split('/');
  if (parts.length !== 3) {
    return null;
  }

  const chapter = Number(parts[1]);
  const verse = Number(parts[2]);
  if (!parts[0] || !Number.isInteger(chapter) || !Number.isInteger(verse)) {
    return null;
  }

  return {
    book: parts[0],
    chapter,
    verse
  };
}
