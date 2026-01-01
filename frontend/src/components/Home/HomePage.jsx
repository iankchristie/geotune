import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectCard from './ProjectCard';
import NewProjectModal from './NewProjectModal';
import { loadProjects, createProject, deleteProject } from '../../services/api';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await loadProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = useCallback(
    async (name, description) => {
      try {
        setIsCreating(true);
        const newProject = await createProject(name, description);
        setIsModalOpen(false);
        navigate(`/project/${newProject.id}`);
      } catch (err) {
        console.error('Failed to create project:', err);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [navigate]
  );

  const handleDeleteProject = useCallback(async (projectId) => {
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('Failed to delete project. Please try again.');
    }
  }, []);

  const handleOpenProject = useCallback(
    (projectId) => {
      navigate(`/project/${projectId}`);
    },
    [navigate]
  );

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-header-content">
          <h1 className="home-title">GeoLabel</h1>
          <p className="home-subtitle">Satellite Imagery Labeling</p>
        </div>
        <button className="create-project-button" onClick={() => setIsModalOpen(true)}>
          + New Project
        </button>
      </div>

      <div className="home-content">
        {isLoading ? (
          <div className="home-loading">
            <p>Loading projects...</p>
          </div>
        ) : error ? (
          <div className="home-error">
            <p>{error}</p>
            <button className="retry-button" onClick={fetchProjects}>
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="home-empty">
            <h2>No Projects Yet</h2>
            <p>Create your first project to start labeling satellite imagery.</p>
            <button className="create-first-button" onClick={() => setIsModalOpen(true)}>
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={handleOpenProject}
                onDelete={handleDeleteProject}
              />
            ))}
          </div>
        )}
      </div>

      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
        isCreating={isCreating}
      />
    </div>
  );
}

export default HomePage;
