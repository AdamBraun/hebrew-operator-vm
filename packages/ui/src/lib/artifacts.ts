export interface ArtifactEntry {
  name: string;
  path: string;
  records: number;
}

export interface ArtifactManifest {
  corpus: string;
  artifactSet: string;
  generatedAt: string;
  artifacts: ArtifactEntry[];
}

const MANIFEST_PATH = '/data/manifest.json';

export const readManifest = async (
  fetcher: typeof fetch = fetch
): Promise<ArtifactManifest> => {
  const response = await fetcher(MANIFEST_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load ${MANIFEST_PATH} (${response.status})`);
  }

  return (await response.json()) as ArtifactManifest;
};
