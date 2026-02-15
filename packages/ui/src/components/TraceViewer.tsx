import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, UIEvent } from 'react';
import type { WordTraceEvent, WordTraceRecord } from '../lib/contracts';

const ROW_HEIGHT = 86;
const VIEWPORT_HEIGHT = 340;
const OVERSCAN_ROWS = 8;
const VIRTUALIZE_THRESHOLD = 80;

type JumpTarget = {
  rowIndex: number;
  eventIndex: number;
} | null;

export interface TraceViewerProps {
  selectedWordIndex: number | null;
  wordTrace: WordTraceRecord | null;
}

export function TraceViewer({ selectedWordIndex, wordTrace }: TraceViewerProps): JSX.Element {
  const [searchText, setSearchText] = useState('');
  const [kindFilter, setKindFilter] = useState('__ALL__');
  const [obligationFilter, setObligationFilter] = useState('__ALL__');
  const [handleFilter, setHandleFilter] = useState('');
  const [jumpInput, setJumpInput] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [focusedEventIndex, setFocusedEventIndex] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [groupByPhase, setGroupByPhase] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canonicalEvents = useMemo(
    () => toCanonicalAtomicEvents(wordTrace?.events ?? [], wordTrace?.ref_key ?? ''),
    [wordTrace?.events, wordTrace?.ref_key]
  );

  const availableKinds = useMemo(
    () => Array.from(new Set(canonicalEvents.map((event) => event.kind))).sort(),
    [canonicalEvents]
  );

  const availableObligations = useMemo(
    () =>
      Array.from(
        new Set(
          canonicalEvents
            .map((event) => event.obligationLabel)
            .filter((label): label is string => Boolean(label))
        )
      ).sort(),
    [canonicalEvents]
  );

  const hasPhases = useMemo(
    () => canonicalEvents.some((event) => event.phaseLabel !== null),
    [canonicalEvents]
  );

  const filteredEvents = useMemo(() => {
    const loweredSearch = searchText.trim().toLowerCase();
    const loweredHandle = handleFilter.trim().toLowerCase();

    return canonicalEvents.filter((event) => {
      if (kindFilter !== '__ALL__' && event.kind !== kindFilter) {
        return false;
      }

      if (obligationFilter !== '__ALL__' && event.obligationLabel !== obligationFilter) {
        return false;
      }

      if (loweredHandle && (!event.handleId || !event.handleId.toLowerCase().includes(loweredHandle))) {
        return false;
      }

      if (!loweredSearch) {
        return true;
      }

      return event.searchBlob.includes(loweredSearch);
    });
  }, [canonicalEvents, handleFilter, kindFilter, obligationFilter, searchText]);

  const groupedEvents = useMemo(() => {
    if (!groupByPhase) {
      return [{ label: 'All events', events: filteredEvents }];
    }

    const groups = new Map<string, CanonicalAtomicEvent[]>();
    for (const event of filteredEvents) {
      const label = event.phaseLabel ?? 'Unphased';
      const current = groups.get(label) ?? [];
      current.push(event);
      groups.set(label, current);
    }
    return Array.from(groups.entries()).map(([label, events]) => ({ label, events }));
  }, [filteredEvents, groupByPhase]);

  const flattenedGroupRows = useMemo(() => {
    const out: Array<{ groupLabel: string; event: CanonicalAtomicEvent }> = [];
    for (const group of groupedEvents) {
      for (const event of group.events) {
        out.push({ groupLabel: group.label, event });
      }
    }
    return out;
  }, [groupedEvents]);

  const totalRows = flattenedGroupRows.length;
  const isVirtualized = totalRows >= VIRTUALIZE_THRESHOLD;
  const startRow = isVirtualized ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS) : 0;
  const visibleRowCount = isVirtualized
    ? Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN_ROWS * 2
    : totalRows;
  const endRow = isVirtualized ? Math.min(totalRows, startRow + visibleRowCount) : totalRows;
  const visibleRows = flattenedGroupRows.slice(startRow, endRow);

  if (!selectedWordIndex) {
    return <p className="status">Select a word to inspect atomic events.</p>;
  }

  if (!wordTrace) {
    return <p className="status">No trace record available for this word.</p>;
  }

  const onCopyEvent = async (event: CanonicalAtomicEvent): Promise<void> => {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      setCopyStatus('Clipboard API unavailable');
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(event.rawEvent, null, 2));
      setCopyStatus(`Copied event #${event.index}`);
    } catch {
      setCopyStatus('Copy failed');
    }
  };

  const onJump = (): void => {
    const target = resolveJumpTarget(jumpInput, flattenedGroupRows);
    if (!target) {
      setCopyStatus('Event not found');
      return;
    }
    setFocusedEventIndex(target.eventIndex);
    listRef.current?.scrollTo({ top: target.rowIndex * ROW_HEIGHT });
  };

  return (
    <div className="trace-viewer" data-testid="trace-viewer">
      <div className="trace-viewer-controls">
        <label className="trace-viewer-control">
          <span>Search</span>
          <input
            data-testid="trace-filter-search"
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="type, DISCHARGE(SUPPORT), payload…"
          />
        </label>

        <label className="trace-viewer-control">
          <span>Event type</span>
          <select
            data-testid="trace-filter-kind"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
          >
            <option value="__ALL__">All</option>
            {availableKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>

        <label className="trace-viewer-control">
          <span>Obligation</span>
          <select
            data-testid="trace-filter-obligation"
            value={obligationFilter}
            onChange={(event) => setObligationFilter(event.target.value)}
          >
            <option value="__ALL__">All</option>
            {availableObligations.map((obligation) => (
              <option key={obligation} value={obligation}>
                {obligation}
              </option>
            ))}
          </select>
        </label>

        <label className="trace-viewer-control">
          <span>Handle id</span>
          <input
            data-testid="trace-filter-handle"
            type="text"
            value={handleFilter}
            onChange={(event) => setHandleFilter(event.target.value)}
            placeholder="e.g. נ:1:1"
          />
        </label>
      </div>

      <div className="trace-viewer-toolbar">
        <label className="trace-viewer-control">
          <span>Jump to event</span>
          <div className="trace-viewer-jump">
            <input
              data-testid="trace-jump-input"
              type="text"
              value={jumpInput}
              onChange={(event) => setJumpInput(event.target.value)}
              placeholder={`${wordTrace.ref_key}#e2 or 2`}
            />
            <button type="button" className="word-inspector-copy" onClick={onJump}>
              Jump
            </button>
          </div>
        </label>
        {hasPhases ? (
          <label className="trace-viewer-phase-toggle">
            <input
              type="checkbox"
              checked={groupByPhase}
              onChange={(event) => setGroupByPhase(event.target.checked)}
            />
            Group by phase
          </label>
        ) : null}
      </div>

      <p className="status" data-testid="trace-results-count">
        Showing {filteredEvents.length} of {canonicalEvents.length} events.
      </p>

      {filteredEvents.length === 0 ? (
        <p className="status">No events match current filters.</p>
      ) : (
        <div
          ref={listRef}
          className="trace-viewer-list"
          data-testid="trace-event-list"
          style={{ height: VIEWPORT_HEIGHT }}
          onScroll={(event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop)}
        >
          {isVirtualized ? (
            <div
              className="trace-viewer-virtual-canvas"
              style={{ height: totalRows * ROW_HEIGHT, position: 'relative' }}
            >
              {visibleRows.map((row, visibleOffset) => {
                const rowIndex = startRow + visibleOffset;
                return renderEventRow({
                  row,
                  rowIndex,
                  rowStyle: {
                    position: 'absolute',
                    insetInline: 0,
                    top: rowIndex * ROW_HEIGHT
                  },
                  showGroupLabel: groupByPhase,
                  focusedEventIndex,
                  onJumpToEvent: (eventIndex) => {
                    const nextTarget = flattenedGroupRows.findIndex(
                      (candidate) => candidate.event.index === eventIndex
                    );
                    if (nextTarget >= 0) {
                      setFocusedEventIndex(eventIndex);
                      listRef.current?.scrollTo({ top: nextTarget * ROW_HEIGHT });
                    }
                  },
                  onCopyEvent
                });
              })}
            </div>
          ) : (
            visibleRows.map((row, rowIndex) =>
              renderEventRow({
                row,
                rowIndex,
                rowStyle: undefined,
                showGroupLabel: groupByPhase,
                focusedEventIndex,
                onJumpToEvent: (eventIndex) => {
                  setFocusedEventIndex(eventIndex);
                },
                onCopyEvent
              })
            )
          )}
        </div>
      )}

      {copyStatus ? (
        <p className="status" data-testid="trace-copy-status">
          {copyStatus}
        </p>
      ) : null}
    </div>
  );
}

interface RenderEventRowArgs {
  row: { groupLabel: string; event: CanonicalAtomicEvent };
  rowIndex: number;
  rowStyle: CSSProperties | undefined;
  showGroupLabel: boolean;
  focusedEventIndex: number | null;
  onJumpToEvent: (eventIndex: number) => void;
  onCopyEvent: (event: CanonicalAtomicEvent) => Promise<void>;
}

function renderEventRow({
  row,
  rowIndex,
  rowStyle,
  showGroupLabel,
  focusedEventIndex,
  onJumpToEvent,
  onCopyEvent
}: RenderEventRowArgs): JSX.Element {
  const { event } = row;
  const anchor = `${event.refKey}#e${event.index}`;
  const isFocused = focusedEventIndex === event.index;

  return (
    <article
      key={`${event.refKey}:${event.index}:${rowIndex}`}
      className={`trace-event-row${isFocused ? ' is-focused' : ''}`}
      data-testid={`trace-event-row-${event.index}`}
      style={rowStyle}
    >
      <div className="trace-event-meta">
        <code>{anchor}</code>
        <span>{event.kind}</span>
        <span>{event.source}</span>
        <span>tau {event.tau}</span>
      </div>
      <p className="trace-event-labels">
        {showGroupLabel ? <span>phase {row.groupLabel}</span> : null}
        {event.obligationLabel ? <span>{event.obligationLabel}</span> : null}
        {event.handleId ? <span>handle {event.handleId}</span> : null}
      </p>
      <div className="trace-event-actions">
        <button type="button" className="word-inspector-copy" onClick={() => onJumpToEvent(event.index)}>
          Jump to event
        </button>
        <button type="button" className="word-inspector-copy" onClick={() => void onCopyEvent(event)}>
          Copy event JSON
        </button>
      </div>
    </article>
  );
}

interface CanonicalAtomicEvent {
  refKey: string;
  kind: string;
  index: number;
  tau: number;
  source: string;
  phaseLabel: string | null;
  obligationLabel: string | null;
  handleId: string | null;
  searchBlob: string;
  rawEvent: WordTraceEvent;
}

function toCanonicalAtomicEvents(events: WordTraceEvent[], refKey: string): CanonicalAtomicEvent[] {
  return events.map((event) => {
    const obligationLabel = toObligationLabel(event.payload);
    const handleId = extractHandleId(event.payload);
    const phaseLabel = extractPhaseLabel(event.payload);
    const searchBlob = [
      event.kind,
      event.source,
      String(event.index),
      String(event.tau),
      obligationLabel ?? '',
      handleId ?? '',
      phaseLabel ?? '',
      safeJson(event.payload)
    ]
      .join(' ')
      .toLowerCase();

    return {
      refKey,
      kind: event.kind,
      index: event.index,
      tau: event.tau,
      source: event.source,
      phaseLabel,
      obligationLabel,
      handleId,
      searchBlob,
      rawEvent: event
    };
  });
}

function toObligationLabel(payload: Record<string, unknown>): string | null {
  const action = readString(payload, ['action', 'op', 'operation']);
  const obligationKind = readString(payload, ['obligation_kind', 'obligationKind']);
  if (!action || !obligationKind) {
    return null;
  }
  return `${action.toUpperCase()}(${obligationKind.toUpperCase()})`;
}

function extractHandleId(payload: Record<string, unknown>): string | null {
  const candidate = readString(payload, [
    'id',
    'handle',
    'handle_id',
    'handleId',
    'target',
    'source',
    'child',
    'parent',
    'inside',
    'outside',
    'boundaryId',
    'residueId',
    'exemplar',
    'focus'
  ]);
  return candidate ?? null;
}

function extractPhaseLabel(payload: Record<string, unknown>): string | null {
  return readString(payload, ['phase', 'phase_label', 'phaseLabel', 'flow_phase']);
}

function readString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function resolveJumpTarget(
  input: string,
  rows: Array<{ groupLabel: string; event: CanonicalAtomicEvent }>
): JumpTarget {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const anchorMatch = trimmed.match(/#e(\d+)$/i);
  if (anchorMatch) {
    const eventIndex = Number(anchorMatch[1]);
    const rowIndex = rows.findIndex((row) => row.event.index === eventIndex);
    return rowIndex >= 0 ? { eventIndex, rowIndex } : null;
  }

  if (/^\d+$/.test(trimmed)) {
    const eventIndex = Number(trimmed);
    const rowIndex = rows.findIndex((row) => row.event.index === eventIndex);
    return rowIndex >= 0 ? { eventIndex, rowIndex } : null;
  }

  return null;
}
