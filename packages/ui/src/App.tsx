import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DiffViewer } from './pages/DiffViewer';
import { GenesisRephrase } from './pages/GenesisRephrase';
import { PatternSearch } from './pages/PatternSearch';
import { TracePage } from './pages/TracePage';
import { VerseExplorer } from './pages/VerseExplorer';
import { WordPage } from './pages/WordPage';

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/verse/Gen-1-1" replace />} />
        <Route path="verse" element={<VerseExplorer />} />
        <Route path="verse/:refSlug" element={<VerseExplorer />} />
        <Route path="word" element={<WordPage />} />
        <Route path="trace" element={<TracePage />} />
        <Route path="pattern" element={<PatternSearch />} />
        <Route path="rephrase" element={<GenesisRephrase />} />
        <Route path="diff" element={<DiffViewer />} />
      </Route>
      <Route path="*" element={<Navigate to="/verse/Gen-1-1" replace />} />
    </Routes>
  );
}

export default App;
