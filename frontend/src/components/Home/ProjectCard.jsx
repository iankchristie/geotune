import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import './ProjectCard.css';

function ProjectCard({ project, onOpen, onDelete }) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleOpenClick = useCallback(() => {
    onOpen(project.id);
  }, [onOpen, project.id]);

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    setIsDeleteModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    try {
      setIsDeleting(true);
      await onDelete(project.id);
      setIsDeleteModalOpen(false);
    } catch {
      setIsDeleting(false);
    }
  }, [onDelete, project.id]);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
  }, []);

  return (
    <>
      <div className="project-card" onClick={handleOpenClick}>
        <div className="project-card-header">
          <h3 className="project-card-title">{project.name}</h3>
          <button
            className="project-delete-button"
            onClick={handleDeleteClick}
            title="Delete project"
            disabled={isDeleting}
          >
            &times;
          </button>
        </div>
        {project.description && (
          <p className="project-card-description">{project.description}</p>
        )}
        <div className="project-card-footer">
          <span className="project-card-date">
            Updated {formatDate(project.updated_at || project.created_at)}
          </span>
          <button className="project-open-button" onClick={handleOpenClick}>
            Open
          </button>
        </div>
      </div>
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This will permanently delete all labels associated with this project.`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}

ProjectCard.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    created_at: PropTypes.string,
    updated_at: PropTypes.string,
  }).isRequired,
  onOpen: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default ProjectCard;
