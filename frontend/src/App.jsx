import { useState, useCallback } from 'react';
import MapContainer from './components/Map/MapContainer';
import Sidebar from './components/Sidebar/Sidebar';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
import useLabels from './hooks/useLabels';
import './App.css';

// Label types
export const LABEL_TYPES = {
  SELECT: 'select',
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
};

function App() {
  const [labelType, setLabelType] = useState(LABEL_TYPES.NEGATIVE);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeChipCenter, setActiveChipCenter] = useState(null);
  const [pendingPolygons, setPendingPolygons] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [chipToDelete, setChipToDelete] = useState(null);

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

  // Request chip deletion (opens modal)
  const handleChipDeleteRequest = useCallback((chipId) => {
    setChipToDelete(chipId);
    setDeleteModalOpen(true);
  }, []);

  // Confirm chip deletion
  const handleConfirmDelete = useCallback(() => {
    if (chipToDelete) {
      deleteChip(chipToDelete);
    }
    setDeleteModalOpen(false);
    setChipToDelete(null);
  }, [chipToDelete, deleteChip]);

  // Cancel chip deletion
  const handleCancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setChipToDelete(null);
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
        onChipDelete={handleChipDeleteRequest}
      />
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Chip"
        message="Are you sure you want to delete this chip and its associated polygons?"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

export default App;
