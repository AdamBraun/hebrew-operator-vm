import { NavLink, useLocation } from 'react-router-dom';
import { DiffViewer } from '../pages/DiffViewer';
import { GenesisRephrase } from '../pages/GenesisRephrase';
import { PatternSearch } from '../pages/PatternSearch';
import { TracePage } from '../pages/TracePage';
import { VerseExplorer } from '../pages/VerseExplorer';
import { WordPage } from '../pages/WordPage';

type PaneKey = 'verse' | 'word' | 'trace' | 'pattern' | 'rephrase' | 'diff';

const panes: Array<{ key: PaneKey; label: string }> = [
  { key: 'verse', label: 'Verse' },
  { key: 'word', label: 'Word' },
  { key: 'trace', label: 'Trace' },
  { key: 'pattern', label: 'Pattern' },
  { key: 'rephrase', label: 'Rephrase' },
  { key: 'diff', label: 'Diff' }
];

const paneForPath = (pathname: string): PaneKey => {
  if (pathname.startsWith('/rephrase')) {
    return 'rephrase';
  }

  if (pathname.startsWith('/pattern')) {
    return 'pattern';
  }

  if (pathname.startsWith('/word')) {
    return 'word';
  }

  if (pathname.startsWith('/trace')) {
    return 'trace';
  }

  if (pathname.startsWith('/diff')) {
    return 'diff';
  }

  return 'verse';
};

export function Layout(): JSX.Element {
  const { pathname, search } = useLocation();
  const activePane = paneForPath(pathname);
  const activePaneLabel = panes.find((pane) => pane.key === activePane)?.label ?? 'Pane';

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-copy">
          <h1>Corpus UI Skeleton</h1>
          <p>Static-ready React shell for verse, trace, paraphrase, and semantic diff review.</p>
        </div>
        <nav aria-label="Primary" className="nav-tabs">
          {panes.map((pane) => (
            <NavLink
              key={pane.key}
              className={({ isActive }) => (isActive ? 'tab is-active' : 'tab')}
              to={{ pathname: `/${pane.key}`, search }}
            >
              {pane.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="pane-grid">
        <section
          aria-label={`${activePaneLabel} pane`}
          className="pane is-active"
        >
          <header className="pane-header">
            <h2>{activePaneLabel}</h2>
          </header>
          <div className="pane-body">
            {activePane === 'verse' ? <VerseExplorer /> : null}
            {activePane === 'word' ? <WordPage /> : null}
            {activePane === 'trace' ? <TracePage /> : null}
            {activePane === 'pattern' ? <PatternSearch /> : null}
            {activePane === 'rephrase' ? <GenesisRephrase /> : null}
            {activePane === 'diff' ? <DiffViewer /> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
