import { useState, useCallback } from 'react';
import MapContainer from './components/Map/MapContainer';
import Sidebar from './components/Sidebar/Sidebar';
import useLabels from './hooks/useLabels';
import './App.css';

// Label types
export const LABEL_TYPES = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
};

function App() {
  const [labelType, setLabelType] = useState(LABEL_TYPES.NEGATIVE);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeChipCenter, setActiveChipCenter] = useState(null);
  const [pendingPolygons, setPendingPolygons] = useState([]);

  const {
    polygons,
    chips,
    addNegativeChip,
    addPositiveChipWithPolygons,
    deleteChip,
    clearAll,
  } = useLabels();

  const handleLabelTypeChange = useCallback((newType) => {
    // Cancel any in-progress annotation when switching types
    if (isAnnotating) {
      setIsAnnotating(false);
      setActiveChipCenter(null);
      setPendingPolygons([]);
    }
    setLabelType(newType);
  }, [isAnnotating]);

  // Start annotating a positive chip
  const handleStartAnnotation = useCallback((center) => {
    setActiveChipCenter(center);
    setIsAnnotating(true);
    setPendingPolygons([]);
  }, []);

  // Add a polygon during annotation
  const handleAddPendingPolygon = useCallback((geometry) => {
    setPendingPolygons((prev) => [...prev, geometry]);
  }, []);

  // Finish annotation and save the chip with its polygons
  const handleFinishAnnotation = useCallback(() => {
    if (activeChipCenter && pendingPolygons.length > 0) {
      addPositiveChipWithPolygons(activeChipCenter, pendingPolygons);
    }
    setIsAnnotating(false);
    setActiveChipCenter(null);
    setPendingPolygons([]);
  }, [activeChipCenter, pendingPolygons, addPositiveChipWithPolygons]);

  // Cancel annotation
  const handleCancelAnnotation = useCallback(() => {
    setIsAnnotating(false);
    setActiveChipCenter(null);
    setPendingPolygons([]);
  }, []);

  const positiveChipCount = chips.filter((c) => c.type === 'positive').length;
  const negativeChipCount = chips.filter((c) => c.type === 'negative').length;

  return (
    <div className="app">
      <Sidebar
        labelType={labelType}
        onLabelTypeChange={handleLabelTypeChange}
        isAnnotating={isAnnotating}
        pendingPolygonCount={pendingPolygons.length}
        onFinishAnnotation={handleFinishAnnotation}
        onCancelAnnotation={handleCancelAnnotation}
        polygonCount={polygons.length}
        positiveChipCount={positiveChipCount}
        negativeChipCount={negativeChipCount}
        onClearAll={clearAll}
      />
      <MapContainer
        labelType={labelType}
        isAnnotating={isAnnotating}
        activeChipCenter={activeChipCenter}
        pendingPolygons={pendingPolygons}
        polygons={polygons}
        chips={chips}
        onStartAnnotation={handleStartAnnotation}
        onAddPendingPolygon={handleAddPendingPolygon}
        onNegativeChipPlace={addNegativeChip}
        onChipDelete={deleteChip}
      />
    </div>
  );
}

export default App;
