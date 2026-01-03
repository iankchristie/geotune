import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getInferenceJobs, getInferenceJob } from '../../services/api';
import './InferenceDetails.css';

function InferenceDetails({ projectId, activeJobId, onShowOverlay, showingOverlay }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load inference jobs
  const loadJobs = useCallback(async () => {
    try {
      const data = await getInferenceJobs(projectId);
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
    const activeJob = jobs.find(
      (j) => j.status === 'pending' || j.status === 'downloading' || j.status === 'inferring'
    );
    if (!activeJob) return;

    const interval = setInterval(async () => {
      try {
        const updatedJob = await getInferenceJob(projectId, activeJob.id);
        setJobs((prev) =>
          prev.map((j) => (j.id === updatedJob.id ? updatedJob : j))
        );

        // Stop polling if job is no longer active
        if (
          updatedJob.status !== 'pending' &&
          updatedJob.status !== 'downloading' &&
          updatedJob.status !== 'inferring'
        ) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to poll inference job:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [projectId, jobs]);

  // Also poll if we have an activeJobId from parent
  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const updatedJob = await getInferenceJob(projectId, activeJobId);
        setJobs((prev) => {
          const existing = prev.find((j) => j.id === activeJobId);
          if (existing) {
            return prev.map((j) => (j.id === activeJobId ? updatedJob : j));
          }
          return [updatedJob, ...prev];
        });

        if (
          updatedJob.status !== 'pending' &&
          updatedJob.status !== 'downloading' &&
          updatedJob.status !== 'inferring'
        ) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to poll active inference job:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [projectId, activeJobId]);

  const activeJob = jobs.find(
    (j) => j.status === 'pending' || j.status === 'downloading' || j.status === 'inferring'
  );
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const failedJobs = jobs.filter((j) => j.status === 'failed');

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'downloading':
        return 'status-downloading';
      case 'inferring':
        return 'status-inferring';
      case 'pending':
        return 'status-pending';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'downloading':
        return 'Downloading';
      case 'inferring':
        return 'Inferring';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="inference-details">
        <div className="inference-loading">Loading inference jobs...</div>
      </div>
    );
  }

  return (
    <div className="inference-details">
      {error && <div className="inference-error">{error}</div>}

      {/* Active Job Progress */}
      {activeJob && (
        <div className="inference-section">
          <h3 className="inference-section-title">Current Inference</h3>
          <div className="inference-job-card active">
            <div className="job-status-row">
              <span className={`job-status ${getStatusColor(activeJob.status)}`}>
                {getStatusLabel(activeJob.status)}
              </span>
              <span className="job-id">Job #{activeJob.id}</span>
            </div>

            <div className="job-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${activeJob.progress || 0}%` }}
                />
              </div>
              <span className="progress-text">
                {activeJob.progress_message || 'Processing...'}
              </span>
            </div>

            <div className="job-time">
              <span>Started: {formatDate(activeJob.created_at)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Latest Completed Job */}
      {completedJobs.length > 0 && (
        <div className="inference-section">
          <h3 className="inference-section-title">Latest Result</h3>
          <div className="inference-job-card">
            <div className="job-status-row">
              <span className={`job-status ${getStatusColor(completedJobs[0].status)}`}>
                {completedJobs[0].status}
              </span>
              <span className="job-id">Job #{completedJobs[0].id}</span>
            </div>

            <div className="overlay-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showingOverlay}
                  onChange={(e) => onShowOverlay(e.target.checked ? completedJobs[0] : null)}
                />
                <span className="toggle-text">Show overlay on map</span>
              </label>
            </div>

            <div className="job-time">
              <span>Completed: {formatDate(completedJobs[0].completed_at)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Failed Jobs */}
      {failedJobs.length > 0 && (
        <div className="inference-section">
          <h3 className="inference-section-title">Failed Jobs</h3>
          <div className="inference-history">
            {failedJobs.slice(0, 3).map((job) => (
              <div key={job.id} className="inference-job-card failed">
                <div className="job-status-row">
                  <span className={`job-status ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                  <span className="job-id">Job #{job.id}</span>
                </div>
                {job.error_message && (
                  <p className="job-error">{job.error_message}</p>
                )}
                <div className="job-time">
                  <span>Failed: {formatDate(job.completed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {jobs.length === 0 && !activeJob && (
        <div className="inference-empty">
          <p>No inference jobs yet.</p>
          <p className="inference-empty-hint">
            Click &quot;Infer on Region&quot; and draw a bounding box to run inference.
          </p>
        </div>
      )}
    </div>
  );
}

InferenceDetails.propTypes = {
  projectId: PropTypes.number.isRequired,
  activeJobId: PropTypes.number,
  onShowOverlay: PropTypes.func.isRequired,
  showingOverlay: PropTypes.bool,
};

export default InferenceDetails;
