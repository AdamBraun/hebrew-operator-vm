import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TracePage } from './pages/TracePage';
import { VersePage } from './pages/VersePage';
import { WordPage } from './pages/WordPage';

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/verse" replace />} />
        <Route path="verse" element={<VersePage />} />
        <Route path="word" element={<WordPage />} />
        <Route path="trace" element={<TracePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/verse" replace />} />
    </Routes>
  );
}

export default App;
