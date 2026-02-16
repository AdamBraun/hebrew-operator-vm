import { createLayeredTextCache } from './cache';
import {
  BundleLoader,
  type BundleInfo,
  type ReferenceCatalog,
  type VerseBundle
} from './loader';
import type {
  RenderOutputRecord,
  VersePhraseTreeRecord,
  WordTraceRecord
} from '../contracts';

const loader = new BundleLoader({
  cache: createLayeredTextCache({
    namespace: 'letters-ui-api'
  })
});

export function getLoadedBundleInfo(): BundleInfo | null {
  return loader.getBundleInfo();
}

export function getReferenceCatalog(): ReferenceCatalog {
  return loader.getReferenceCatalog();
}

export async function loadBundle(versionTag = 'latest'): Promise<BundleInfo> {
  return loader.loadBundle(versionTag);
}

export async function getVerse(ref_key: string): Promise<VerseBundle | null> {
  return loader.getVerse(ref_key);
}

export async function getWords(ref_key: string): Promise<WordTraceRecord[]> {
  return loader.getWords(ref_key);
}

export async function getWord(
  ref_key: string,
  wordIndex: number
): Promise<WordTraceRecord | null> {
  return loader.getWord(ref_key, wordIndex);
}

export async function getPhraseTree(
  ref_key: string
): Promise<VersePhraseTreeRecord | null> {
  return loader.getPhraseTree(ref_key);
}

export async function getParaphrase(ref_key: string): Promise<RenderOutputRecord[]> {
  const chunk = await loader.getParaphraseChunk(ref_key);
  return chunk?.records ?? [];
}
