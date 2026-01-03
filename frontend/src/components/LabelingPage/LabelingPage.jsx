import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MapContainer from '../Map/MapContainer';
import Sidebar from '../Sidebar/Sidebar';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import MapBlade from '../MapBlade/MapBlade';
import ChipDetails from '../MapBlade/ChipDetails';
import ExportDetails from '../MapBlade/ExportDetails';
import TrainingDetails from '../MapBlade/TrainingDetails';
import InferenceDetails from '../MapBlade/InferenceDetails';
import SampleDetails from '../MapBlade/SampleDetails';
import SelectDetails from '../MapBlade/SelectDetails';
import useLabels from '../../hooks/useLabels';
import {
  getProject,
  loadLabels,
  saveLabels,
  clearLabels,
  checkHasTrainedModel,
  startInference,
  getInferenceOverlayUrl,
  getLatestTraining,
  getLatestInference,
} from '../../services/api';
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
  const [showInference, setShowInference] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [showSelect, setShowSelect] = useState(false);
  const [cameFromExport, setCameFromExport] = useState(false);

  // Inference state
  const [hasTrainedModel, setHasTrainedModel] = useState(false);
  const [isDrawingBounds, setIsDrawingBounds] = useState(false);
  const [activeInferenceJobId, setActiveInferenceJobId] = useState(null);
  const [inferenceOverlay, setInferenceOverlay] = useState(null);
  const [showInferenceOverlay, setShowInferenceOverlay] = useState(false);

  // Latest job state for sidebar info cards
  const [latestTrainingJob, setLatestTrainingJob] = useState(null);
  const [latestInferenceJob, setLatestInferenceJob] = useState(null);

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
  const hasInitiallyLoaded = useRef(false);

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

        // Mark initial load complete after state is set
        setTimeout(() => {
          hasInitiallyLoaded.current = true;
        }, 0);
      } catch (error) {
        console.error('Failed to load project:', error);
        setLoadError('Failed to load project. It may not exist.');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [projectId, setInitialState]);

  // Auto-save when chips or polygons change (after initial load)
  useEffect(() => {
    if (!hasInitiallyLoaded.current || !project) return;

    const saveTimeout = setTimeout(async () => {
      try {
        await saveLabels(project.id, chips, polygons);
      } catch (error) {
        console.error('Failed to auto-save labels:', error);
      }
    }, 300); // Debounce saves by 300ms

    return () => clearTimeout(saveTimeout);
  }, [chips, polygons, project]);

  // Check for trained model on mount and after training
  useEffect(() => {
    async function checkModel() {
      try {
        const result = await checkHasTrainedModel(parseInt(projectId, 10));
        setHasTrainedModel(result.has_model);
      } catch (error) {
        console.error('Failed to check for trained model:', error);
        setHasTrainedModel(false);
      }
    }

    if (!isLoading) {
      checkModel();
    }
  }, [projectId, isLoading, showTraining]);

  // Load latest training job for sidebar info
  useEffect(() => {
    async function loadLatestTraining() {
      try {
        const job = await getLatestTraining(parseInt(projectId, 10));
        setLatestTrainingJob(job);
      } catch (error) {
        // No training jobs yet is fine
        setLatestTrainingJob(null);
      }
    }

    if (!isLoading) {
      loadLatestTraining();
    }
  }, [projectId, isLoading, showTraining]);

  // Load latest inference job for sidebar info
  useEffect(() => {
    async function loadLatestInference() {
      try {
        const job = await getLatestInference(parseInt(projectId, 10));
        setLatestInferenceJob(job);
      } catch (error) {
        // No inference jobs yet is fine
        setLatestInferenceJob(null);
      }
    }

    if (!isLoading) {
      loadLatestInference();
    }
  }, [projectId, isLoading, showInference, activeInferenceJobId]);

  const handleBackToProjects = useCallback(() => {
    navigate('/');
  }, [navigate]);

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
    setShowInference(false);
    setShowSample(false);
    setShowSelect(false);
    setCameFromExport(false);
    // Deactivate tile placement mode when closing any blade
    setLabelType(LABEL_TYPES.SELECT);
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
    setShowInference(false);
    setShowSample(false);
    setShowSelect(false);
    setLabelType(LABEL_TYPES.SELECT);
  }, []);

  const handleOpenTraining = useCallback(() => {
    setSelectedChipId(null);
    setShowExport(false);
    setShowTraining(true);
    setShowInference(false);
    setShowSample(false);
    setShowSelect(false);
    setLabelType(LABEL_TYPES.SELECT);
  }, []);

  const handleShowInference = useCallback(() => {
    setSelectedChipId(null);
    setShowExport(false);
    setShowTraining(false);
    setShowInference(true);
    setShowSample(false);
    setShowSelect(false);
    setLabelType(LABEL_TYPES.SELECT);
  }, []);

  const handleOpenSample = useCallback(() => {
    setSelectedChipId(null);
    setShowExport(false);
    setShowTraining(false);
    setShowInference(false);
    setShowSample(true);
    setShowSelect(false);
    setLabelType(LABEL_TYPES.SELECT);
  }, []);

  const handleOpenSelect = useCallback(() => {
    setSelectedChipId(null);
    setShowExport(false);
    setShowTraining(false);
    setShowInference(false);
    setShowSample(false);
    setShowSelect(true);
    setLabelType(LABEL_TYPES.SELECT);
  }, []);

  const handleSelectPositive = useCallback(() => {
    setLabelType(LABEL_TYPES.POSITIVE);
    // Keep blade open
  }, []);

  const handleSelectNegative = useCallback(() => {
    setLabelType(LABEL_TYPES.NEGATIVE);
    // Keep blade open
  }, []);

  // Inference handlers
  const handleStartDrawing = useCallback(() => {
    setIsDrawingBounds(true);
  }, []);

  const handleBoundsDrawn = useCallback(async (bounds) => {
    setIsDrawingBounds(false);

    try {
      const job = await startInference(parseInt(projectId, 10), bounds);
      setActiveInferenceJobId(job.id);
      // Close any other open blades before showing inference
      setSelectedChipId(null);
      setShowExport(false);
      setShowTraining(false);
      setShowSample(false);
      setLabelType(LABEL_TYPES.SELECT);
      setShowInference(true);
    } catch (error) {
      console.error('Failed to start inference:', error);
      alert(`Failed to start inference: ${error.message}`);
    }
  }, [projectId]);

  const handleCancelBoundsDrawing = useCallback(() => {
    setIsDrawingBounds(false);
  }, []);

  const handleShowOverlay = useCallback((job) => {
    if (job) {
      setInferenceOverlay({
        url: getInferenceOverlayUrl(parseInt(projectId, 10), job.id),
        bounds: job.bounds,
      });
      setShowInferenceOverlay(true);
    } else {
      setShowInferenceOverlay(false);
    }
  }, [projectId]);

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
          isAnnotating={isAnnotating}
          polygonCount={polygons.length}
          positiveChipCount={positiveChipCount}
          negativeChipCount={negativeChipCount}
          onClearAll={handleClearAll}
          projectName={project?.name}
          onBackToProjects={handleBackToProjects}
          onExport={handleOpenExport}
          onTrain={handleOpenTraining}
          onInfer={handleShowInference}
          onSample={handleOpenSample}
          onSelect={handleOpenSelect}
          latestTrainingJob={latestTrainingJob}
          latestInferenceJob={latestInferenceJob}
          onShowTraining={handleOpenTraining}
          onShowInference={handleShowInference}
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
        isDrawingBounds={isDrawingBounds}
        onBoundsDrawn={handleBoundsDrawn}
        onCancelBoundsDrawing={handleCancelBoundsDrawing}
        inferenceOverlay={inferenceOverlay}
        showInferenceOverlay={showInferenceOverlay}
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
      {showInference && (
        <MapBlade
          isOpen={true}
          onClose={handleCloseBlade}
          title="Inference Results"
        >
          <InferenceDetails
            projectId={parseInt(projectId, 10)}
            activeJobId={activeInferenceJobId}
            onShowOverlay={handleShowOverlay}
            showingOverlay={showInferenceOverlay}
            hasTrainedModel={hasTrainedModel}
            isDrawingBounds={isDrawingBounds}
            onStartDrawing={handleStartDrawing}
          />
        </MapBlade>
      )}
      {showSample && (
        <MapBlade
          isOpen={true}
          onClose={handleCloseBlade}
          title="Sample"
        >
          <SampleDetails
            labelType={labelType}
            onSelectPositive={handleSelectPositive}
            onSelectNegative={handleSelectNegative}
            isAnnotating={isAnnotating}
            pendingPolygonCount={pendingPolygons.length}
            onFinishAnnotation={handleFinishAnnotation}
            onCancelAnnotation={handleCancelAnnotation}
          />
        </MapBlade>
      )}
      {showSelect && (
        <MapBlade
          isOpen={true}
          onClose={handleCloseBlade}
          title="Select"
        >
          <SelectDetails />
        </MapBlade>
      )}
      {!showExport && !showTraining && !showInference && !showSample && !showSelect && selectedChip && (
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
