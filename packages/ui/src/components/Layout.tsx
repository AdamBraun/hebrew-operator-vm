import { NavLink, useLocation } from 'react-router-dom';
import { PatternSearch } from '../pages/PatternSearch';
import { TracePage } from '../pages/TracePage';
import { VerseExplorer } from '../pages/VerseExplorer';
import { WordPage } from '../pages/WordPage';

type PaneKey = 'verse' | 'word' | 'trace' | 'pattern';

const panes: Array<{ key: PaneKey; label: string }> = [
  { key: 'verse', label: 'Verse' },
  { key: 'word', label: 'Word' },
  { key: 'trace', label: 'Trace' },
  { key: 'pattern', label: 'Pattern' }
];

const paneForPath = (pathname: string): PaneKey => {
  if (pathname.startsWith('/pattern')) {
    return 'pattern';
  }

  if (pathname.startsWith('/word')) {
    return 'word';
  }

  if (pathname.startsWith('/trace')) {
    return 'trace';
  }

  return 'verse';
};

export function Layout(): JSX.Element {
  const { pathname, search } = useLocation();
  const activePane = paneForPath(pathname);

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-copy">
          <h1>Corpus UI Skeleton</h1>
          <p>Static-ready React shell for Verse, Word, Trace, and Pattern views.</p>
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
        {panes.map((pane) => (
          <section
            key={pane.key}
            aria-label={`${pane.label} pane`}
            className={pane.key === activePane ? 'pane is-active' : 'pane'}
          >
            <header className="pane-header">
              <h2>{pane.label}</h2>
            </header>
            <div className="pane-body">
              {pane.key === 'verse' ? <VerseExplorer /> : null}
              {pane.key === 'word' ? <WordPage /> : null}
              {pane.key === 'trace' ? <TracePage /> : null}
              {pane.key === 'pattern' ? <PatternSearch /> : null}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
