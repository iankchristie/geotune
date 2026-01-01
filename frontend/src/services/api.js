const API_BASE_URL = '/api';

// ============ Projects API ============

export async function loadProjects() {
  const response = await fetch(`${API_BASE_URL}/projects`);
  if (!response.ok) {
    throw new Error('Failed to load projects');
  }
  return response.json();
}

export async function createProject(name, description = '') {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!response.ok) {
    throw new Error('Failed to create project');
  }
  return response.json();
}

export async function getProject(projectId) {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`);
  if (!response.ok) {
    throw new Error('Failed to get project');
  }
  return response.json();
}

export async function deleteProject(projectId) {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete project');
  }
  return response.json();
}

// ============ Labels API ============

export async function loadLabels(projectId) {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/labels`);
  if (!response.ok) {
    throw new Error('Failed to load labels');
  }
  return response.json();
}

export async function saveLabels(projectId, chips, polygons) {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chips, polygons }),
  });
  if (!response.ok) {
    throw new Error('Failed to save labels');
  }
  return response.json();
}

export async function clearLabels(projectId) {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/labels`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to clear labels');
  }
  return response.json();
}
