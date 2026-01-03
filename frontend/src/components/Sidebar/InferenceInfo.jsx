import PropTypes from 'prop-types';
import InfoCard from './InfoCard';

function InferenceInfo({ latestJob, onClick }) {
  const getStatus = () => {
    if (!latestJob) return null;
    if (latestJob.status === 'pending' || latestJob.status === 'downloading' || latestJob.status === 'inferring') {
      return 'status-inferring';
    }
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
      return <span className="info-muted">No inferences</span>;
    }

    const isRunning = ['pending', 'downloading', 'inferring'].includes(latestJob.status);

    if (isRunning) {
      const progress = Math.round(latestJob.progress || 0);
      return (
        <div className="info-card-progress">
          <div className="info-card-progress-bar">
            <div className="info-card-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="info-card-progress-text">{progress}%</span>
        </div>
      );
    }

    if (latestJob.status === 'completed') {
      return <span>Completed ({formatDate(latestJob.completed_at)})</span>;
    }

    if (latestJob.status === 'failed') {
      return <span>Failed ({formatDate(latestJob.completed_at)})</span>;
    }

    return <span className="info-muted">No inferences</span>;
  };

  return (
    <InfoCard title="Inference" status={getStatus()} onClick={onClick}>
      {renderContent()}
    </InfoCard>
  );
}

InferenceInfo.propTypes = {
  latestJob: PropTypes.shape({
    id: PropTypes.number,
    status: PropTypes.string,
    progress: PropTypes.number,
    completed_at: PropTypes.string,
  }),
  onClick: PropTypes.func,
};

export default InferenceInfo;
