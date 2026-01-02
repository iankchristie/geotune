import PropTypes from 'prop-types';
import { LABEL_TYPES } from '../LabelingPage/LabelingPage';
import './Sidebar.css';

function Sidebar({
  labelType,
  onLabelTypeChange,
  isAnnotating,
  pendingPolygonCount,
  onFinishAnnotation,
  onCancelAnnotation,
  polygonCount,
  positiveChipCount,
  negativeChipCount,
  onClearAll,
  onSave,
  isSaving,
  saveStatus,
  projectName,
  onBackToProjects,
  onExport,
}) {
  const totalChips = positiveChipCount + negativeChipCount;

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

      {isAnnotating ? (
        <div className="sidebar-section annotation-section">
          <h2 className="section-title">Annotating Chip</h2>
          <p className="annotation-info">
            Draw polygons around features of interest within the selected chip.
          </p>
          <div className="annotation-stats">
            <span>Polygons drawn: {pendingPolygonCount}</span>
          </div>
          <div className="annotation-actions">
            <button
              className="action-button primary"
              onClick={onFinishAnnotation}
              disabled={pendingPolygonCount === 0}
            >
              Finish Annotation
            </button>
            <button className="action-button secondary" onClick={onCancelAnnotation}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="sidebar-section">
          <h2 className="section-title">Mode</h2>
          <div className="mode-buttons">
            <button
              className={`mode-button mode-select ${labelType === LABEL_TYPES.SELECT ? 'active' : ''}`}
              onClick={() => onLabelTypeChange(LABEL_TYPES.SELECT)}
            >
              Select
            </button>
            <button
              className={`mode-button mode-positive ${labelType === LABEL_TYPES.POSITIVE ? 'active' : ''}`}
              onClick={() => onLabelTypeChange(LABEL_TYPES.POSITIVE)}
            >
              Positive
            </button>
            <button
              className={`mode-button mode-negative ${labelType === LABEL_TYPES.NEGATIVE ? 'active' : ''}`}
              onClick={() => onLabelTypeChange(LABEL_TYPES.NEGATIVE)}
            >
              Negative
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <h2 className="section-title">Labels</h2>
        <div className="stats">
          <div className="stat-row">
            <span className="stat-label">Positive Chips:</span>
            <span className="stat-value stat-positive">{positiveChipCount}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Negative Chips:</span>
            <span className="stat-value stat-negative">{negativeChipCount}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Polygons:</span>
            <span className="stat-value">{polygonCount}</span>
          </div>
          <div className="stat-row stat-total">
            <span className="stat-label">Total Chips:</span>
            <span className="stat-value">{totalChips}</span>
          </div>
        </div>
      </div>

      <div className="sidebar-section">
        <h2 className="section-title">Actions</h2>
        <div className="action-buttons">
          <button
            className="action-button save"
            onClick={onSave}
            disabled={totalChips === 0 || isAnnotating || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Labels'}
          </button>
          <button
            className="action-button export"
            onClick={onExport}
            disabled={totalChips === 0 || isAnnotating || isSaving}
          >
            Exported Imagery
          </button>
          <button
            className="action-button danger"
            onClick={onClearAll}
            disabled={totalChips === 0 || isAnnotating || isSaving}
          >
            Clear All Labels
          </button>
        </div>
        {saveStatus === 'success' && (
          <div className="save-status success">Labels saved successfully!</div>
        )}
        {saveStatus === 'error' && (
          <div className="save-status error">Failed to save labels. Please try again.</div>
        )}
      </div>

    </div>
  );
}

Sidebar.propTypes = {
  labelType: PropTypes.string.isRequired,
  onLabelTypeChange: PropTypes.func.isRequired,
  isAnnotating: PropTypes.bool.isRequired,
  pendingPolygonCount: PropTypes.number.isRequired,
  onFinishAnnotation: PropTypes.func.isRequired,
  onCancelAnnotation: PropTypes.func.isRequired,
  polygonCount: PropTypes.number.isRequired,
  positiveChipCount: PropTypes.number.isRequired,
  negativeChipCount: PropTypes.number.isRequired,
  onClearAll: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  isSaving: PropTypes.bool.isRequired,
  saveStatus: PropTypes.oneOf(['success', 'error', null]),
  projectName: PropTypes.string,
  onBackToProjects: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
};

export default Sidebar;
