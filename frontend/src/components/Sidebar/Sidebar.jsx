import PropTypes from 'prop-types';
import { LABEL_TYPES } from '../../App';
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
}) {
  const totalChips = positiveChipCount + negativeChipCount;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">GeoLabel</h1>
        <p className="sidebar-subtitle">Satellite Imagery Labeling</p>
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
          <h2 className="section-title">Label Type</h2>
          <div className="mode-buttons">
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
        <button
          className="action-button danger"
          onClick={onClearAll}
          disabled={totalChips === 0 || isAnnotating}
        >
          Clear All Labels
        </button>
      </div>

      <div className="sidebar-section sidebar-help">
        <h2 className="section-title">Instructions</h2>
        <ul className="help-list">
          <li>
            <strong>Positive:</strong> Click on a chip location to select it, then draw polygons
            around features of interest. Click &ldquo;Finish Annotation&rdquo; when done.
          </li>
          <li>
            <strong>Negative:</strong> Click on the map to place a negative sample chip at that
            location.
          </li>
          <li>
            <strong>Delete:</strong> Click on any existing chip to delete it.
          </li>
        </ul>
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
};

export default Sidebar;
