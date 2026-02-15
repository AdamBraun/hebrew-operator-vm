import type { RefObject } from 'react';

export interface RefPickerProps {
  books: string[];
  chapters: number[];
  verses: number[];
  selectedBook: string;
  selectedChapter: number;
  selectedVerse: number;
  refInputValue: string;
  inputError: string | null;
  canPrev: boolean;
  canNext: boolean;
  onBookChange: (book: string) => void;
  onChapterChange: (chapter: number) => void;
  onVerseChange: (verse: number) => void;
  onRefInputChange: (value: string) => void;
  onRefInputSubmit: () => void;
  onPrev: () => void;
  onNext: () => void;
  searchInputRef: RefObject<HTMLInputElement>;
}

export function RefPicker({
  books,
  chapters,
  verses,
  selectedBook,
  selectedChapter,
  selectedVerse,
  refInputValue,
  inputError,
  canPrev,
  canNext,
  onBookChange,
  onChapterChange,
  onVerseChange,
  onRefInputChange,
  onRefInputSubmit,
  onPrev,
  onNext,
  searchInputRef
}: RefPickerProps): JSX.Element {
  return (
    <section className="ref-picker" aria-label="Reference navigator">
      <div className="ref-picker-controls">
        <label className="ref-picker-field">
          <span>Book</span>
          <select
            data-testid="book-select"
            value={selectedBook}
            onChange={(event) => onBookChange(event.target.value)}
          >
            {books.map((book) => (
              <option key={book} value={book}>
                {book}
              </option>
            ))}
          </select>
        </label>
        <label className="ref-picker-field">
          <span>Chapter</span>
          <select
            data-testid="chapter-select"
            value={String(selectedChapter)}
            onChange={(event) => onChapterChange(Number(event.target.value))}
          >
            {chapters.map((chapter) => (
              <option key={chapter} value={chapter}>
                {chapter}
              </option>
            ))}
          </select>
        </label>
        <label className="ref-picker-field">
          <span>Verse</span>
          <select
            data-testid="verse-select"
            value={String(selectedVerse)}
            onChange={(event) => onVerseChange(Number(event.target.value))}
          >
            {verses.map((verse) => (
              <option key={verse} value={verse}>
                {verse}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          data-testid="prev-ref-button"
          className="nav-button"
          onClick={onPrev}
          disabled={!canPrev}
        >
          Prev
        </button>
        <button
          type="button"
          data-testid="next-ref-button"
          className="nav-button"
          onClick={onNext}
          disabled={!canNext}
        >
          Next
        </button>
      </div>

      <div className="ref-picker-direct">
        <label htmlFor="ref-picker-input">Direct ref_key</label>
        <input
          ref={searchInputRef}
          id="ref-picker-input"
          data-testid="ref-key-input"
          type="text"
          value={refInputValue}
          onChange={(event) => onRefInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onRefInputSubmit();
            }
          }}
          placeholder="Genesis/1/1"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          className="nav-button"
          data-testid="ref-key-submit"
          onClick={onRefInputSubmit}
        >
          Go
        </button>
      </div>

      {inputError ? <p className="status status-error">{inputError}</p> : null}
      <p className="status ref-picker-hints">Shortcuts: j next, k previous, / focus</p>
    </section>
  );
}
