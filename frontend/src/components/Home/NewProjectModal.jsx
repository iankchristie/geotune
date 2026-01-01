import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import './NewProjectModal.css';

function NewProjectModal({ isOpen, onClose, onCreate, isCreating }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);

      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Project name is required');
        return;
      }

      try {
        await onCreate(trimmedName, description.trim());
        setName('');
        setDescription('');
      } catch {
        setError('Failed to create project. Please try again.');
      }
    },
    [name, description, onCreate]
  );

  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    setError(null);
    onClose();
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && !isCreating) {
        handleClose();
      }
    },
    [handleClose, isCreating]
  );

  if (!isOpen) return null;

  return (
    <div className="new-project-overlay" onClick={handleOverlayClick}>
      <div className="new-project-modal">
        <h2 className="new-project-title">Create New Project</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="project-name" className="form-label">
              Project Name <span className="required">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              disabled={isCreating}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="project-description" className="form-label">
              Description
            </label>
            <textarea
              id="project-description"
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              disabled={isCreating}
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button
              type="button"
              className="form-button cancel"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button type="submit" className="form-button create" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

NewProjectModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  isCreating: PropTypes.bool.isRequired,
};

export default NewProjectModal;
