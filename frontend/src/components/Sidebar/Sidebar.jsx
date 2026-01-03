import PropTypes from 'prop-types';
import LabelsInfo from './LabelsInfo';
import ModelsInfo from './ModelsInfo';
import InferenceInfo from './InferenceInfo';
import './Sidebar.css';

function Sidebar({
  labelType,
  isAnnotating,
  polygonCount,
  positiveChipCount,
  negativeChipCount,
  onClearAll,
  projectName,
  onBackToProjects,
  onExport,
  onTrain,
  onInfer,
  onSample,
  onSelect,
  latestTrainingJob,
  latestInferenceJob,
  onShowTraining,
  onShowInference,
}) {
  const totalChips = positiveChipCount + negativeChipCount;
  const isDisabled = isAnnotating;
  const isSelectMode = labelType === 'select';
  const isSampleMode = labelType === 'positive' || labelType === 'negative';

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="back-to-projects" onClick={onBackToProjects} title="Back to projects">
          &larr;
        </button>
        <div className="sidebar-header-text">
          <h1 className="sidebar-title">{projectName || 'Untitled Project'}</h1>
        </div>
      </div>

      {/* Information Section */}
      <div className="sidebar-section">
        <h2 className="section-title">Information</h2>
        <div className="info-cards">
          <LabelsInfo
            positiveChipCount={positiveChipCount}
            negativeChipCount={negativeChipCount}
            polygonCount={polygonCount}
          />
          <ModelsInfo
            latestJob={latestTrainingJob}
            onClick={onShowTraining}
          />
          <InferenceInfo
            latestJob={latestInferenceJob}
            onClick={onShowInference}
          />
        </div>
      </div>

      {/* Actions Section */}
      <div className="sidebar-section">
        <h2 className="section-title">Actions</h2>
        <div className="action-buttons">
          <button
            className={`action-button select ${isSelectMode ? 'active' : ''}`}
            onClick={onSelect}
            disabled={isDisabled}
          >
            Select
          </button>
          <button
            className={`action-button sample ${isSampleMode || isAnnotating ? 'active' : ''}`}
            onClick={onSample}
            disabled={isDisabled}
          >
            Sample
          </button>
          <button
            className="action-button export"
            onClick={onExport}
            disabled={totalChips === 0 || isDisabled}
          >
            View Imagery
          </button>
          <button
            className="action-button train"
            onClick={onTrain}
            disabled={positiveChipCount === 0 || isDisabled}
          >
            Train Model
          </button>
          <button
            className="action-button infer"
            onClick={onInfer}
            disabled={isDisabled}
          >
            Infer on Region
          </button>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="sidebar-section sidebar-footer">
        <div className="action-buttons">
          <button
            className="action-button danger"
            onClick={onClearAll}
            disabled={totalChips === 0 || isDisabled}
          >
            Clear All Labels
          </button>
        </div>
      </div>
    </div>
  );
}

Sidebar.propTypes = {
  labelType: PropTypes.string.isRequired,
  isAnnotating: PropTypes.bool.isRequired,
  polygonCount: PropTypes.number.isRequired,
  positiveChipCount: PropTypes.number.isRequired,
  negativeChipCount: PropTypes.number.isRequired,
  onClearAll: PropTypes.func.isRequired,
  projectName: PropTypes.string,
  onBackToProjects: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  onTrain: PropTypes.func.isRequired,
  onInfer: PropTypes.func.isRequired,
  onSample: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  latestTrainingJob: PropTypes.object,
  latestInferenceJob: PropTypes.object,
  onShowTraining: PropTypes.func,
  onShowInference: PropTypes.func,
};

export default Sidebar;
