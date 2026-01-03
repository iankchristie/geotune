import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MapContainer from '../Map/MapContainer';
import Sidebar from '../Sidebar/Sidebar';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import MapBlade from '../MapBlade/MapBlade';
import ChipDetails from '../MapBlade/ChipDetails';
import ExportDetails from '../MapBlade/ExportDetails';
import TrainingDetails from '../MapBlade/TrainingDetails';
import useLabels from '../../hooks/useLabels';
import { getProject, loadLabels, saveLabels, clearLabels } from '../../services/api';
import './LabelingPage.css';

// Label types
export const LABEL_TYPES = {
  SELECT: 'select',
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
};

function LabelingPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [labelType, setLabelType] = useState(LABEL_TYPES.NEGATIVE);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeChipCenter, setActiveChipCenter] = useState(null);
  const [pendingPolygons, setPendingPolygons] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [chipToDelete, setChipToDelete] = useState(null);
  const [selectedChipId, setSelectedChipId] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [cameFromExport, setCameFromExport] = useState(false);

  const {
    polygons,
    chips,
    addNegativeChip,
    addPositiveChipWithPolygons,
    deleteChip,
    clearAll,
    setInitialState,
  } = useLabels();

  // Project and loading state
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Load project and labels on mount
  useEffect(() => {
    async function loadProject() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const projectData = await getProject(projectId);
        setProject(projectData);

        const { chips: loadedChips, polygons: loadedPolygons } = await loadLabels(projectId);
        setInitialState(loadedChips, loadedPolygons);
      } catch (error) {
        console.error('Failed to load project:', error);
        setLoadError('Failed to load project. It may not exist.');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [projectId, setInitialState]);

  const handleBackToProjects = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleLabelTypeChange = useCallback(
    (newType) => {
      if (isAnnotating) {
        setIsAnnotating(false);
        setActiveChipCenter(null);
        setPendingPolygons([]);
      }
      // Clear selection and close blade when changing modes
      setSelectedChipId(null);
      setShowExport(false);
      setLabelType(newType);
    },
    [isAnnotating]
  );

  const handleStartAnnotation = useCallback((center) => {
    setActiveChipCenter(center);
    setIsAnnotating(true);
    setPendingPolygons([]);
  }, []);

  const handleAddPendingPolygon = useCallback((geometry) => {
    setPendingPolygons((prev) => [...prev, geometry]);
  }, []);

  const handleFinishAnnotation = useCallback(() => {
    if (activeChipCenter && pendingPolygons.length > 0) {
      addPositiveChipWithPolygons(activeChipCenter, pendingPolygons);
    }
    setIsAnnotating(false);
    setActiveChipCenter(null);
    setPendingPolygons([]);
  }, [activeChipCenter, pendingPolygons, addPositiveChipWithPolygons]);

  const handleCancelAnnotation = useCallback(() => {
    setIsAnnotating(false);
    setActiveChipCenter(null);
    setPendingPolygons([]);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setChipToDelete(null);
  }, []);

  // Chip selection handlers for MapBlade
  const handleChipSelect = useCallback((chipId) => {
    // Track if we're navigating from export view
    setCameFromExport(showExport);
    setSelectedChipId(chipId);
    setShowExport(false);
  }, [showExport]);

  const handleCloseBlade = useCallback(() => {
    setSelectedChipId(null);
    setShowExport(false);
    setShowTraining(false);
    setCameFromExport(false);
  }, []);

  const handleBackToExport = useCallback(() => {
    setSelectedChipId(null);
    setShowExport(true);
    setShowTraining(false);
    setCameFromExport(false);
  }, []);

  const handleOpenExport = useCallback(() => {
    setSelectedChipId(null);
    setShowExport(true);
    setShowTraining(false);
  }, []);

  const handleOpenTraining = useCallback(() => {
    setSelectedChipId(null);
    setShowExport(false);
    setShowTraining(true);
  }, []);

  const handleDeleteSelectedChip = useCallback(() => {
    if (selectedChipId) {
      setChipToDelete(selectedChipId);
      setDeleteModalOpen(true);
    }
  }, [selectedChipId]);

  // When chip is deleted, clear selection if it was the selected chip
  const handleConfirmDeleteWithClear = useCallback(() => {
    if (chipToDelete) {
      deleteChip(chipToDelete);
      if (chipToDelete === selectedChipId) {
        setSelectedChipId(null);
      }
    }
    setDeleteModalOpen(false);
    setChipToDelete(null);
  }, [chipToDelete, deleteChip, selectedChipId]);

  // Compute selected chip and its polygons
  const selectedChip = useMemo(() => {
    if (!selectedChipId) return null;
    return chips.find((c) => c.id === selectedChipId) || null;
  }, [selectedChipId, chips]);

  const selectedChipPolygonCount = useMemo(() => {
    if (!selectedChipId) return 0;
    return polygons.filter((p) => p.chipId === selectedChipId).length;
  }, [selectedChipId, polygons]);

  const handleSave = useCallback(async () => {
    if (!project) return;

    try {
      setIsSaving(true);
      setSaveStatus(null);
      await saveLabels(project.id, chips, polygons);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save labels:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [project, chips, polygons]);

  const handleClearAll = useCallback(async () => {
    if (!project) {
      clearAll();
      return;
    }

    try {
      await clearLabels(project.id);
      clearAll();
    } catch (error) {
      console.error('Failed to clear labels on server:', error);
      clearAll();
    }
  }, [project, clearAll]);

  const positiveChipCount = chips.filter((c) => c.type === 'positive').length;
  const negativeChipCount = chips.filter((c) => c.type === 'negative').length;

  if (loadError) {
    return (
      <div className="labeling-page">
        <div className="labeling-error">
          <h2>Error Loading Project</h2>
          <p>{loadError}</p>
          <button className="back-button" onClick={handleBackToProjects}>
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="labeling-page">
      {isLoading ? (
        <div className="sidebar loading-sidebar">
          <div className="sidebar-header">
            <h1 className="sidebar-title">GeoLabel</h1>
            <p className="sidebar-subtitle">Loading...</p>
          </div>
        </div>
      ) : (
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
          onClearAll={handleClearAll}
          onSave={handleSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
          projectName={project?.name}
          onBackToProjects={handleBackToProjects}
          onExport={handleOpenExport}
          onTrain={handleOpenTraining}
        />
      )}
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
        onChipSelect={handleChipSelect}
        selectedChipId={selectedChipId}
      />
      {showExport && (
        <MapBlade
          isOpen={true}
          onClose={handleCloseBlade}
          title="Exported Imagery"
        >
          <ExportDetails projectId={parseInt(projectId, 10)} onChipSelect={handleChipSelect} />
        </MapBlade>
      )}
      {showTraining && (
        <MapBlade
          isOpen={true}
          onClose={handleCloseBlade}
          title="Model Training"
        >
          <TrainingDetails projectId={parseInt(projectId, 10)} />
        </MapBlade>
      )}
      {!showExport && !showTraining && selectedChip && (
        <MapBlade
          isOpen={true}
          onClose={handleCloseBlade}
          onBack={cameFromExport ? handleBackToExport : undefined}
          title="Chip Details"
        >
          <ChipDetails
            chip={selectedChip}
            polygonCount={selectedChipPolygonCount}
            onDelete={handleDeleteSelectedChip}
          />
        </MapBlade>
      )}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Chip"
        message="Are you sure you want to delete this chip and its associated polygons?"
        onConfirm={handleConfirmDeleteWithClear}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

export default LabelingPage;
