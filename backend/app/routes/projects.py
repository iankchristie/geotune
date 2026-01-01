from datetime import datetime
from flask import Blueprint, jsonify, request
from app.database import get_db

projects_bp = Blueprint('projects', __name__)


@projects_bp.route('/projects', methods=['GET'])
def list_projects():
    """List all projects."""
    db = get_db()
    cursor = db.execute(
        'SELECT id, name, description, created_at, updated_at FROM projects ORDER BY updated_at DESC'
    )
    projects = [dict(row) for row in cursor.fetchall()]
    return jsonify(projects)


@projects_bp.route('/projects', methods=['POST'])
def create_project():
    """Create a new project."""
    data = request.get_json()

    if not data or 'name' not in data:
        return jsonify({'error': 'Project name is required'}), 400

    name = data['name']
    description = data.get('description', '')
    now = datetime.utcnow().isoformat() + 'Z'

    db = get_db()
    cursor = db.execute(
        'INSERT INTO projects (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)',
        (name, description, now, now)
    )
    db.commit()

    project_id = cursor.lastrowid

    return jsonify({
        'id': project_id,
        'name': name,
        'description': description,
        'created_at': now,
        'updated_at': now
    }), 201


@projects_bp.route('/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    """Get a single project by ID."""
    db = get_db()
    cursor = db.execute(
        'SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?',
        (project_id,)
    )
    row = cursor.fetchone()

    if row is None:
        return jsonify({'error': 'Project not found'}), 404

    return jsonify(dict(row))


@projects_bp.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project and all its associated data."""
    db = get_db()

    # Check if project exists
    cursor = db.execute('SELECT id FROM projects WHERE id = ?', (project_id,))
    if cursor.fetchone() is None:
        return jsonify({'error': 'Project not found'}), 404

    # Delete project (cascades to chips and polygons via foreign keys)
    db.execute('DELETE FROM projects WHERE id = ?', (project_id,))
    db.commit()

    return jsonify({'message': 'Project deleted successfully'})
