import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  getChipThumbnailUrl,
  checkChipThumbnailExists,
  getChipMetadata,
  getChipMaskUrl,
  checkChipMaskExists,
} from '../../services/api';
import './ChipDetails.css';

function ChipDetails({ chip, polygonCount, onDelete }) {
  const [thumbnailExists, setThumbnailExists] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [metadata, setMetadata] = useState(null);
  const [maskExists, setMaskExists] = useState(false);
  const [showMaskOverlay, setShowMaskOverlay] = useState(false);

  useEffect(() => {
    if (!chip) {
      setThumbnailExists(false);
      setThumbnailLoading(false);
      setMetadata(null);
      setMaskExists(false);
      setShowMaskOverlay(false);
      return;
    }

    const chipId = chip.id;
    const isPositive = chip.type === 'positive';

    async function loadChipData() {
      setThumbnailLoading(true);

      // Check thumbnail, metadata, and mask (for positive chips) in parallel
      const promises = [
        checkChipThumbnailExists(chipId),
        getChipMetadata(chipId),
      ];

      if (isPositive) {
        promises.push(checkChipMaskExists(chipId));
      }

      const results = await Promise.all(promises);

      setThumbnailExists(results[0]);
      setMetadata(results[1]);
      setMaskExists(isPositive ? results[2] : false);
      setThumbnailLoading(false);
    }

    loadChipData();
  }, [chip]);

  if (!chip) return null;

  const thumbnailUrl = getChipThumbnailUrl(chip.id);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCoordinate = (value) => {
    return value.toFixed(6);
  };

  const isPositive = chip.type === 'positive';

  return (
    <div className="chip-details">
      <div className="chip-details-section">
        <div className="chip-type-badge-container">
          <span className={`chip-type-badge ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? 'Positive' : 'Negative'}
          </span>
        </div>
      </div>

      <div className="chip-details-section">
        <h3 className="chip-details-label">Sentinel-2 RGB Preview</h3>
        <div className="chip-thumbnail-container">
          {thumbnailLoading && (
            <div className="chip-thumbnail-loading">
              <div className="chip-thumbnail-spinner" />
              <span>Checking for imagery...</span>
            </div>
          )}
          {!thumbnailLoading && thumbnailExists && (
            <div className="chip-thumbnail-wrapper">
              <img
                src={thumbnailUrl}
                alt="Sentinel-2 RGB composite"
                className="chip-thumbnail-image"
              />
              {showMaskOverlay && maskExists && (
                <img
                  src={getChipMaskUrl(chip.id)}
                  alt="Mask overlay"
                  className="chip-mask-overlay"
                />
              )}
            </div>
          )}
          {!thumbnailLoading && !thumbnailExists && (
            <div className="chip-thumbnail-placeholder">
              <span className="chip-thumbnail-placeholder-icon">&#x1F4E5;</span>
              <span>Export required</span>
              <span className="chip-thumbnail-placeholder-hint">
                Use Export Imagery to download satellite data
              </span>
            </div>
          )}
        </div>
        {isPositive && thumbnailExists && maskExists && (
          <label className="chip-mask-toggle">
            <input
              type="checkbox"
              checked={showMaskOverlay}
              onChange={(e) => setShowMaskOverlay(e.target.checked)}
            />
            Show mask overlay
          </label>
        )}
      </div>

      <div className="chip-details-section">
        <h3 className="chip-details-label">Chip ID</h3>
        <p className="chip-details-value">{chip.id}</p>
      </div>

      {metadata ? (
        <>
          <div className="chip-details-section">
            <h3 className="chip-details-label">Bounding Box</h3>
            <div className="chip-coords">
              <div className="chip-coord-row">
                <span className="chip-coord-label">North:</span>
                <span className="chip-coord-value">{formatCoordinate(metadata.bounds.north)}</span>
              </div>
              <div className="chip-coord-row">
                <span className="chip-coord-label">South:</span>
                <span className="chip-coord-value">{formatCoordinate(metadata.bounds.south)}</span>
              </div>
              <div className="chip-coord-row">
                <span className="chip-coord-label">East:</span>
                <span className="chip-coord-value">{formatCoordinate(metadata.bounds.east)}</span>
              </div>
              <div className="chip-coord-row">
                <span className="chip-coord-label">West:</span>
                <span className="chip-coord-value">{formatCoordinate(metadata.bounds.west)}</span>
              </div>
            </div>
          </div>

          <div className="chip-details-section">
            <h3 className="chip-details-label">Dimensions</h3>
            <div className="chip-coords">
              <div className="chip-coord-row">
                <span className="chip-coord-label">Pixels:</span>
                <span className="chip-coord-value">{metadata.dimensions.width} × {metadata.dimensions.height}</span>
              </div>
              <div className="chip-coord-row">
                <span className="chip-coord-label">Size:</span>
                <span className="chip-coord-value">{metadata.dimensions.widthMeters} × {metadata.dimensions.heightMeters} m</span>
              </div>
              <div className="chip-coord-row">
                <span className="chip-coord-label">Area:</span>
                <span className="chip-coord-value">{metadata.dimensions.areaSqKm} km²</span>
              </div>
              <div className="chip-coord-row">
                <span className="chip-coord-label">Resolution:</span>
                <span className="chip-coord-value">{metadata.resolution.x} m/px</span>
              </div>
              <div className="chip-coord-row">
                <span className="chip-coord-label">Bands:</span>
                <span className="chip-coord-value">{metadata.bandCount}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="chip-details-section">
          <h3 className="chip-details-label">GeoTIFF Metadata</h3>
          <p className="chip-details-value chip-details-muted">
            Export imagery to view spatial metadata
          </p>
        </div>
      )}

      {isPositive && (
        <div className="chip-details-section">
          <h3 className="chip-details-label">Polygons</h3>
          <p className="chip-details-value">
            {polygonCount} polygon{polygonCount !== 1 ? 's' : ''} drawn
          </p>
        </div>
      )}

      <div className="chip-details-section">
        <h3 className="chip-details-label">Created</h3>
        <p className="chip-details-value">{formatDate(chip.createdAt)}</p>
      </div>

      <div className="chip-details-actions">
        <button className="chip-delete-button" onClick={onDelete}>
          Delete Chip
        </button>
      </div>
    </div>
  );
}

ChipDetails.propTypes = {
  chip: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['positive', 'negative']).isRequired,
    center: PropTypes.shape({
      lng: PropTypes.number.isRequired,
      lat: PropTypes.number.isRequired,
    }).isRequired,
    createdAt: PropTypes.string.isRequired,
  }),
  polygonCount: PropTypes.number,
  onDelete: PropTypes.func.isRequired,
};

ChipDetails.defaultProps = {
  polygonCount: 0,
};

export default ChipDetails;
