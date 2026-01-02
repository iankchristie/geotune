import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getImageryStatus, getChipThumbnailUrl } from '../../services/api';
import './ExportDetails.css';

function ExportDetails({ projectId, onChipSelect }) {
  const [imageryStatus, setImageryStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load imagery status
  useEffect(() => {
    async function loadStatus() {
      try {
        setIsLoading(true);
        const data = await getImageryStatus(projectId);
        setImageryStatus(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadStatus();
  }, [projectId]);

  // Poll for updates while there are pending/downloading chips
  useEffect(() => {
    if (!imageryStatus) return;

    const hasActiveDownloads =
      imageryStatus.downloadingChips > 0 || imageryStatus.pendingChips > 0;

    if (!hasActiveDownloads) return;

    const interval = setInterval(async () => {
      try {
        const data = await getImageryStatus(projectId);
        setImageryStatus(data);
      } catch (err) {
        console.error('Failed to poll imagery status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [projectId, imageryStatus]);

  if (isLoading) {
    return <div className="export-details loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="export-details">
        <div className="export-error">{error}</div>
      </div>
    );
  }

  if (!imageryStatus || imageryStatus.totalChips === 0) {
    return (
      <div className="export-details">
        <div className="imagery-empty">
          <p>No chips to display.</p>
          <p className="imagery-empty-hint">
            Save labels to start downloading imagery.
          </p>
        </div>
      </div>
    );
  }

  const { totalChips, downloadedChips, downloadingChips, pendingChips, failedChips, chips } =
    imageryStatus;

  const progress = totalChips > 0 ? Math.round((downloadedChips / totalChips) * 100) : 0;
  const isDownloading = downloadingChips > 0 || pendingChips > 0;

  // Separate chips by status for display
  const downloadedChipsList = chips.filter((c) => c.status === 'completed');

  return (
    <div className="export-details">
      <div className="export-section">
        <h3 className="export-section-title">Exported Imagery</h3>
        <p className="export-section-description">
          Sentinel-2 RGB imagery for labeled chips.
        </p>
      </div>

      {/* Progress section */}
      <div className="imagery-progress-section">
        <div className="export-progress-header">
          <span className="export-progress-status">
            {isDownloading ? 'Downloading...' : 'Complete'}
          </span>
          <span className="export-progress-count">
            {downloadedChips} / {totalChips} chips
          </span>
        </div>

        <div className="export-progress-bar">
          <div className="export-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {failedChips > 0 && (
          <div className="export-progress-warning">
            {failedChips} chip{failedChips !== 1 ? 's' : ''} failed to download
          </div>
        )}
      </div>

      {/* Gallery grid */}
      {downloadedChipsList.length > 0 && (
        <div className="imagery-gallery-section">
          <h3 className="export-section-title">Gallery</h3>
          <div className="imagery-gallery-grid">
            {downloadedChipsList.map((chip) => (
              <button
                key={chip.chipId}
                className={`imagery-gallery-item ${chip.type}`}
                onClick={() => onChipSelect(chip.chipId)}
                type="button"
              >
                <img
                  src={getChipThumbnailUrl(chip.chipId)}
                  alt={`Chip ${chip.chipId}`}
                  className="imagery-gallery-image"
                />
                <div className="imagery-gallery-overlay">
                  <span className={`imagery-gallery-badge ${chip.type}`}>
                    {chip.type === 'positive' ? '+' : '-'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

ExportDetails.propTypes = {
  projectId: PropTypes.number.isRequired,
  onChipSelect: PropTypes.func.isRequired,
};

export default ExportDetails;
