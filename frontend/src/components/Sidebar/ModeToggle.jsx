import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './ModeToggle.css';

function ModeToggle({ labelType, onLabelTypeChange, disabled }) {
  const [tileMenuOpen, setTileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setTileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isTileMode = labelType === 'positive' || labelType === 'negative';

  const handleTileClick = () => {
    if (disabled) return;
    setTileMenuOpen(!tileMenuOpen);
  };

  const handleSelectPositive = () => {
    onLabelTypeChange('positive');
    setTileMenuOpen(false);
  };

  const handleSelectNegative = () => {
    onLabelTypeChange('negative');
    setTileMenuOpen(false);
  };

  const handleSelectMode = () => {
    if (disabled) return;
    onLabelTypeChange('select');
    setTileMenuOpen(false);
  };

  const getTileLabel = () => {
    if (labelType === 'positive') return 'Tile (+)';
    if (labelType === 'negative') return 'Tile (-)';
    return 'Tile';
  };

  return (
    <div className="mode-toggle">
      <button
        className={`mode-toggle-btn ${labelType === 'select' ? 'active' : ''}`}
        onClick={handleSelectMode}
        disabled={disabled}
      >
        Select
      </button>
      <div className="tile-dropdown" ref={dropdownRef}>
        <button
          className={`mode-toggle-btn tile-btn ${isTileMode ? 'active' : ''}`}
          onClick={handleTileClick}
          disabled={disabled}
        >
          {getTileLabel()}
          <span className="dropdown-arrow">▼</span>
        </button>
        {tileMenuOpen && (
          <div className="tile-menu">
            <button
              className={`tile-menu-item ${labelType === 'positive' ? 'active' : ''}`}
              onClick={handleSelectPositive}
            >
              <span className="tile-indicator positive" />
              Positive
            </button>
            <button
              className={`tile-menu-item ${labelType === 'negative' ? 'active' : ''}`}
              onClick={handleSelectNegative}
            >
              <span className="tile-indicator negative" />
              Negative
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

ModeToggle.propTypes = {
  labelType: PropTypes.oneOf(['select', 'positive', 'negative']).isRequired,
  onLabelTypeChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default ModeToggle;
