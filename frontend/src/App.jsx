import { Routes, Route } from 'react-router-dom';
import HomePage from './components/Home/HomePage';
import LabelingPage from './components/LabelingPage/LabelingPage';
import './App.css';

// Re-export LABEL_TYPES for backwards compatibility
export { LABEL_TYPES } from './components/LabelingPage/LabelingPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/project/:projectId" element={<LabelingPage />} />
    </Routes>
  );
}

export default App;
