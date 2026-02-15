import { useEffect, useState } from 'react';
import {
  readValidatedDataset,
  type ValidatedDataset
} from '../lib/artifacts';

export function VersePage(): JSX.Element {
  const [dataset, setDataset] = useState<ValidatedDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void readValidatedDataset()
      .then((nextDataset) => {
        if (!cancelled) {
          setDataset(nextDataset);
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
        <p className="status status-error">Dataset load failed: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <p>Verse page placeholder.</p>
      {dataset ? (
        <div className="status">
          <p>
            Loaded and validated <code>/public/data/manifest.json</code> (
            {dataset.artifactSummaries.length} artifacts)
          </p>
          <ul className="artifact-list">
            {dataset.artifactSummaries.map((artifact) => (
              <li key={artifact.kind}>
                <code>{artifact.kind}</code> {'->'} <code>{artifact.path}</code> (
                {artifact.records}{' '}
                records)
              </li>
            ))}
          </ul>
          <ul className="artifact-list">
            {dataset.versionStatuses.map((status) => (
              <li
                key={status.field}
                className={
                  status.level === 'error'
                    ? 'status-error'
                    : status.level === 'warning'
                    ? 'status-warning'
                    : undefined
                }
              >
                <code>{status.field}</code>: {status.value} ({status.message})
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
