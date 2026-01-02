import PropTypes from 'prop-types';
import './MapBlade.css';

function MapBlade({ isOpen, onClose, onBack, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="map-blade">
      <div className="map-blade-header">
        {onBack && (
          <button className="map-blade-back" onClick={onBack} title="Back">
            &larr;
          </button>
        )}
        <h2 className="map-blade-title">{title}</h2>
        <button className="map-blade-close" onClick={onClose} title="Close">
          &times;
        </button>
      </div>
      <div className="map-blade-content">{children}</div>
    </div>
  );
}

MapBlade.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onBack: PropTypes.func,
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default MapBlade;
