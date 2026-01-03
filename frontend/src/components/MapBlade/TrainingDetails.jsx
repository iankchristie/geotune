import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getTrainingJobs, startTraining, getTrainingJob } from '../../services/api';
import './TrainingDetails.css';

function TrainingDetails({ projectId }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  // Load training jobs
  const loadJobs = useCallback(async () => {
    try {
      const data = await getTrainingJobs(projectId);
      setJobs(data.jobs);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Poll for updates if there's an active job
  useEffect(() => {
    const activeJob = jobs.find((j) => j.status === 'running' || j.status === 'pending');
    if (!activeJob) return;

    const interval = setInterval(async () => {
      try {
        const updatedJob = await getTrainingJob(projectId, activeJob.id);
        setJobs((prev) =>
          prev.map((j) => (j.id === updatedJob.id ? updatedJob : j))
        );

        // Stop polling if job is no longer active
        if (updatedJob.status !== 'running' && updatedJob.status !== 'pending') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to poll training job:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [projectId, jobs]);

  const handleStartTraining = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const newJob = await startTraining(projectId);
      setJobs((prev) => [newJob, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  const activeJob = jobs.find((j) => j.status === 'running' || j.status === 'pending');
  const pastJobs = jobs.filter((j) => j.status !== 'running' && j.status !== 'pending');

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const formatMetric = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(4);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'running':
        return 'status-running';
      case 'pending':
        return 'status-pending';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="training-details">
        <div className="training-loading">Loading training jobs...</div>
      </div>
    );
  }

  return (
    <div className="training-details">
      {error && <div className="training-error">{error}</div>}

      {/* Start Training Button */}
      <div className="training-action">
        <button
          className="start-training-button"
          onClick={handleStartTraining}
          disabled={isStarting || activeJob}
        >
          {isStarting ? 'Starting...' : activeJob ? 'Training in Progress' : 'Start Training'}
        </button>
        {activeJob && (
          <p className="training-active-hint">
            A training job is currently {activeJob.status}.
          </p>
        )}
      </div>

      {/* Active Job Progress */}
      {activeJob && (
        <div className="training-section">
          <h3 className="training-section-title">Current Training</h3>
          <div className="training-job-card active">
            <div className="job-status-row">
              <span className={`job-status ${getStatusColor(activeJob.status)}`}>
                {activeJob.status}
              </span>
              <span className="job-id">Job #{activeJob.id}</span>
            </div>

            {activeJob.status === 'running' && (
              <>
                <div className="job-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${((activeJob.current_epoch || 0) / activeJob.total_epochs) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="progress-text">
                    Epoch {activeJob.current_epoch || 0} / {activeJob.total_epochs}
                  </span>
                </div>

                <div className="job-metrics">
                  <div className="metric">
                    <span className="metric-label">Train Loss</span>
                    <span className="metric-value">{formatMetric(activeJob.train_loss)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Val Loss</span>
                    <span className="metric-value">{formatMetric(activeJob.val_loss)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Val IoU</span>
                    <span className="metric-value">{formatMetric(activeJob.val_iou)}</span>
                  </div>
                </div>
              </>
            )}

            {activeJob.status === 'pending' && (
              <p className="job-pending-text">Waiting to start...</p>
            )}

            <div className="job-time">
              <span>Started: {formatDate(activeJob.started_at)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Training History */}
      {pastJobs.length > 0 && (
        <div className="training-section">
          <h3 className="training-section-title">Training History</h3>
          <div className="training-history">
            {pastJobs.map((job) => (
              <div key={job.id} className="training-job-card">
                <div className="job-status-row">
                  <span className={`job-status ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                  <span className="job-id">Job #{job.id}</span>
                </div>

                {job.status === 'completed' && (
                  <div className="job-metrics">
                    <div className="metric">
                      <span className="metric-label">Final Val Loss</span>
                      <span className="metric-value">{formatMetric(job.val_loss)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Final Val IoU</span>
                      <span className="metric-value">{formatMetric(job.val_iou)}</span>
                    </div>
                  </div>
                )}

                {job.status === 'failed' && job.error_message && (
                  <p className="job-error">{job.error_message}</p>
                )}

                <div className="job-time">
                  <span>Completed: {formatDate(job.completed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div className="training-empty">
          <p>No training jobs yet.</p>
          <p className="training-empty-hint">
            Click &quot;Start Training&quot; to train a model on your labeled data.
          </p>
        </div>
      )}
    </div>
  );
}

TrainingDetails.propTypes = {
  projectId: PropTypes.number.isRequired,
};

export default TrainingDetails;
