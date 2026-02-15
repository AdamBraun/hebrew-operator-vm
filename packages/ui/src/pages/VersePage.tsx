import { useEffect, useState } from 'react';
import { readManifest, type ArtifactManifest } from '../lib/artifacts';

export function VersePage(): JSX.Element {
  const [manifest, setManifest] = useState<ArtifactManifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void readManifest()
      .then((nextManifest) => {
        if (!cancelled) {
          setManifest(nextManifest);
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unknown error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div>
        <p>Verse page placeholder.</p>
        <p className="status status-error">Manifest load failed: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <p>Verse page placeholder.</p>
      {manifest ? (
        <div className="status">
          <p>
            Loaded <code>/public/data/manifest.json</code> ({manifest.artifacts.length} artifacts)
          </p>
          <ul className="artifact-list">
            {manifest.artifacts.map((artifact) => (
              <li key={artifact.path}>
                <code>{artifact.path}</code> - {artifact.records} records
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="status">Loading deterministic corpus artifacts...</p>
      )}
    </div>
  );
}
