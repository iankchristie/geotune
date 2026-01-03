import PropTypes from 'prop-types';
import InfoCard from './InfoCard';

function ModelsInfo({ latestJob, onClick }) {
  const getStatus = () => {
    if (!latestJob) return null;
    if (latestJob.status === 'running' || latestJob.status === 'pending') return 'status-training';
    if (latestJob.status === 'completed') return 'status-completed';
    if (latestJob.status === 'failed') return 'status-failed';
    return null;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const renderContent = () => {
    if (!latestJob) {
      return <span className="info-muted">No model</span>;
    }

    if (latestJob.status === 'running') {
      const progress = latestJob.total_epochs > 0
        ? Math.round((latestJob.current_epoch / latestJob.total_epochs) * 100)
        : 0;
      return (
        <div className="info-card-progress">
          <div className="info-card-progress-bar">
            <div className="info-card-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="info-card-progress-text">{progress}%</span>
        </div>
      );
    }

    if (latestJob.status === 'pending') {
      return <span>Training pending...</span>;
    }

    if (latestJob.status === 'completed') {
      return <span>Trained ({formatDate(latestJob.completed_at)})</span>;
    }

    if (latestJob.status === 'failed') {
      return <span>Failed ({formatDate(latestJob.completed_at)})</span>;
    }

    return <span className="info-muted">No model</span>;
  };

  return (
    <InfoCard title="Models" status={getStatus()} onClick={onClick}>
      {renderContent()}
    </InfoCard>
  );
}

ModelsInfo.propTypes = {
  latestJob: PropTypes.shape({
    id: PropTypes.number,
    status: PropTypes.string,
    current_epoch: PropTypes.number,
    total_epochs: PropTypes.number,
    completed_at: PropTypes.string,
  }),
  onClick: PropTypes.func,
};

export default ModelsInfo;
