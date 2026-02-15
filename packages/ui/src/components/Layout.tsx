import { NavLink, useLocation, useOutlet } from 'react-router-dom';

type PaneKey = 'verse' | 'word' | 'trace';

const panes: Array<{ key: PaneKey; label: string }> = [
  { key: 'verse', label: 'Verse' },
  { key: 'word', label: 'Word' },
  { key: 'trace', label: 'Trace' }
];

const paneForPath = (pathname: string): PaneKey => {
  if (pathname.startsWith('/word')) {
    return 'word';
  }

  if (pathname.startsWith('/trace')) {
    return 'trace';
  }

  return 'verse';
};

export function Layout(): JSX.Element {
  const outlet = useOutlet();
  const { pathname } = useLocation();
  const activePane = paneForPath(pathname);

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-copy">
          <h1>Corpus UI Skeleton</h1>
          <p>Static-ready React shell for Verse, Word, and Trace views.</p>
        </div>
        <nav aria-label="Primary" className="nav-tabs">
          {panes.map((pane) => (
            <NavLink
              key={pane.key}
              className={({ isActive }) => (isActive ? 'tab is-active' : 'tab')}
              to={`/${pane.key}`}
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
              {pane.key === activePane ? (
                outlet
              ) : (
                <p className="placeholder">Navigate to {pane.label} to load this pane.</p>
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
