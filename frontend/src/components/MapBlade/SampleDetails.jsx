import PropTypes from 'prop-types';
import './SampleDetails.css';

function SampleDetails({
  labelType,
  onSelectPositive,
  onSelectNegative,
  isAnnotating,
  pendingPolygonCount,
  onFinishAnnotation,
  onCancelAnnotation,
}) {
  const isPositiveMode = labelType === 'positive';
  const isNegativeMode = labelType === 'negative';

  // Show annotation UI when annotating a positive chip
  if (isAnnotating) {
    return (
      <div className="sample-details">
        <div className="annotation-section">
          <h3 className="annotation-title">Annotating Chip</h3>
          <p className="annotation-description">
            Draw polygons around features of interest within the selected chip.
          </p>
          <div className="annotation-stats">
            <span>Polygons drawn: {pendingPolygonCount}</span>
          </div>
          <div className="annotation-actions">
            <button
              className="annotation-button primary"
              onClick={onFinishAnnotation}
              disabled={pendingPolygonCount === 0}
            >
              Finish Annotation
            </button>
            <button
              className="annotation-button secondary"
              onClick={onCancelAnnotation}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sample-details">
      <p className="sample-description">
        Choose a sample type to place on the map. Click on the map to place sample tiles.
      </p>

      <div className="sample-buttons">
        <button
          className={`sample-type-button positive ${isPositiveMode ? 'active' : ''}`}
          onClick={onSelectPositive}
        >
          <span className="sample-indicator positive" />
          <div className="sample-button-content">
            <span className="sample-button-title">Positive</span>
            <span className="sample-button-desc">Contains features of interest</span>
          </div>
          {isPositiveMode && <span className="sample-active-badge">Active</span>}
        </button>

        <button
          className={`sample-type-button negative ${isNegativeMode ? 'active' : ''}`}
          onClick={onSelectNegative}
        >
          <span className="sample-indicator negative" />
          <div className="sample-button-content">
            <span className="sample-button-title">Negative</span>
            <span className="sample-button-desc">No features of interest</span>
          </div>
          {isNegativeMode && <span className="sample-active-badge">Active</span>}
        </button>
      </div>

      {(isPositiveMode || isNegativeMode) && (
        <p className="sample-hint">
          {isPositiveMode
            ? 'Click on the map to place a positive sample tile and draw polygons.'
            : 'Click on the map to place a negative sample tile.'}
        </p>
      )}
    </div>
  );
}

SampleDetails.propTypes = {
  labelType: PropTypes.string,
  onSelectPositive: PropTypes.func.isRequired,
  onSelectNegative: PropTypes.func.isRequired,
  isAnnotating: PropTypes.bool,
  pendingPolygonCount: PropTypes.number,
  onFinishAnnotation: PropTypes.func,
  onCancelAnnotation: PropTypes.func,
};

export default SampleDetails;
