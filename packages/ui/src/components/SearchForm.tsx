import type { FormEvent } from 'react';

export type PatternQueryMode = 'skeleton' | 'subsequence' | 'motif';

export interface SearchMotifOption {
  name: string;
  description: string;
}

export interface SearchFormProps {
  mode: PatternQueryMode;
  value: string;
  limit: number;
  motifOptions: SearchMotifOption[];
  disabled?: boolean;
  isSearching?: boolean;
  onModeChange: (mode: PatternQueryMode) => void;
  onValueChange: (value: string) => void;
  onLimitChange: (limit: number) => void;
  onSubmit: () => void;
}

export function SearchForm({
  mode,
  value,
  limit,
  motifOptions,
  disabled = false,
  isSearching = false,
  onModeChange,
  onValueChange,
  onLimitChange,
  onSubmit
}: SearchFormProps): JSX.Element {
  const valueLabel = mode === 'motif' ? 'Motif' : 'Pattern';
  const valuePlaceholder =
    mode === 'skeleton'
      ? 'GIMEL.BESTOW|TAV.FINALIZE'
      : mode === 'subsequence'
      ? 'GIMEL.BESTOW|*.FINALIZE'
      : 'Select motif';

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className="pattern-search-form"
      data-testid="pattern-search-form"
      onSubmit={handleSubmit}
    >
      <div className="pattern-search-fields">
        <label className="pattern-search-field">
          <span>Mode</span>
          <select
            data-testid="pattern-mode-select"
            value={mode}
            disabled={disabled}
            onChange={(event) => onModeChange(event.target.value as PatternQueryMode)}
          >
            <option value="skeleton">skeleton</option>
            <option value="subsequence">subsequence</option>
            <option value="motif">motif</option>
          </select>
        </label>

        <label className="pattern-search-field pattern-search-field-value">
          <span>{valueLabel}</span>
          {mode === 'motif' ? (
            <select
              data-testid="pattern-value-motif"
              value={value}
              disabled={disabled || motifOptions.length === 0}
              onChange={(event) => onValueChange(event.target.value)}
            >
              {motifOptions.length === 0 ? (
                <option value="">No motifs available</option>
              ) : (
                motifOptions.map((motif) => (
                  <option key={motif.name} value={motif.name}>
                    {motif.name}
                  </option>
                ))
              )}
            </select>
          ) : (
            <input
              data-testid="pattern-value-input"
              type="text"
              value={value}
              disabled={disabled}
              placeholder={valuePlaceholder}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => onValueChange(event.target.value)}
            />
          )}
        </label>

        <label className="pattern-search-field pattern-search-field-limit">
          <span>Limit</span>
          <input
            data-testid="pattern-limit-input"
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(limit) ? String(limit) : '200'}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onLimitChange(Number.isFinite(parsed) ? parsed : 1);
            }}
          />
        </label>

        <button
          type="submit"
          data-testid="pattern-search-submit"
          className="nav-button pattern-search-submit"
          disabled={disabled || isSearching}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      <p className="status pattern-search-help">
        CLI parity: <code>query skeleton</code>, <code>query subsequence</code>,{' '}
        <code>query motif</code>.
      </p>
    </form>
  );
}
