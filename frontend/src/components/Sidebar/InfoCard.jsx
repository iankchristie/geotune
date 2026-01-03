import PropTypes from 'prop-types';
import './InfoCard.css';

function InfoCard({ title, children, status, onClick }) {
  const isClickable = !!onClick;

  return (
    <div
      className={`info-card ${status || ''} ${isClickable ? 'clickable' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <span className="info-card-title">{title}</span>
      <div className="info-card-content">{children}</div>
    </div>
  );
}

InfoCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  status: PropTypes.string,
  onClick: PropTypes.func,
};

export default InfoCard;
