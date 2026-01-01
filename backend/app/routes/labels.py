import json
from datetime import datetime
from flask import Blueprint, jsonify, request
from app.database import get_db

labels_bp = Blueprint('labels', __name__)


@labels_bp.route('/projects/<int:project_id>/labels', methods=['GET'])
def get_labels(project_id):
    """Get all chips and polygons for a project."""
    db = get_db()

    # Verify project exists
    cursor = db.execute('SELECT id FROM projects WHERE id = ?', (project_id,))
    if cursor.fetchone() is None:
        return jsonify({'error': 'Project not found'}), 404

    # Get all chips for this project
    cursor = db.execute(
        '''SELECT id, geometry_geojson, center_lng, center_lat, chip_type, created_at
           FROM chips WHERE project_id = ?''',
        (project_id,)
    )
    chips = []
    for row in cursor.fetchall():
        chips.append({
            'id': row['id'],
            'geometry': json.loads(row['geometry_geojson']),
            'center': {'lng': row['center_lng'], 'lat': row['center_lat']},
            'type': row['chip_type'],
            'createdAt': row['created_at']
        })

    # Get all polygons for chips in this project
    cursor = db.execute(
        '''SELECT p.id, p.chip_id, p.geometry_geojson, p.created_at
           FROM polygons p
           JOIN chips c ON p.chip_id = c.id
           WHERE c.project_id = ?''',
        (project_id,)
    )
    polygons = []
    for row in cursor.fetchall():
        polygons.append({
            'id': row['id'],
            'chipId': row['chip_id'],
            'geometry': json.loads(row['geometry_geojson']),
            'createdAt': row['created_at']
        })

    return jsonify({'chips': chips, 'polygons': polygons})


@labels_bp.route('/projects/<int:project_id>/labels', methods=['POST'])
def save_labels(project_id):
    """Save chips and polygons for a project (replaces all existing data)."""
    db = get_db()

    # Verify project exists
    cursor = db.execute('SELECT id FROM projects WHERE id = ?', (project_id,))
    if cursor.fetchone() is None:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    chips = data.get('chips', [])
    polygons = data.get('polygons', [])

    # Delete existing labels for this project
    db.execute('DELETE FROM chips WHERE project_id = ?', (project_id,))

    # Insert new chips
    for chip in chips:
        db.execute(
            '''INSERT INTO chips (id, project_id, geometry_geojson, center_lng, center_lat, chip_type, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (
                chip['id'],
                project_id,
                json.dumps(chip['geometry']),
                chip['center']['lng'],
                chip['center']['lat'],
                chip['type'],
                chip.get('createdAt', datetime.utcnow().isoformat() + 'Z')
            )
        )

    # Insert new polygons
    for polygon in polygons:
        db.execute(
            '''INSERT INTO polygons (id, chip_id, geometry_geojson, created_at)
               VALUES (?, ?, ?, ?)''',
            (
                polygon['id'],
                polygon['chipId'],
                json.dumps(polygon['geometry']),
                polygon.get('createdAt', datetime.utcnow().isoformat() + 'Z')
            )
        )

    # Update project's updated_at timestamp
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute('UPDATE projects SET updated_at = ? WHERE id = ?', (now, project_id))

    db.commit()

    return jsonify({
        'message': 'Labels saved successfully',
        'chipCount': len(chips),
        'polygonCount': len(polygons)
    })


@labels_bp.route('/projects/<int:project_id>/labels', methods=['DELETE'])
def clear_labels(project_id):
    """Clear all labels for a project."""
    db = get_db()

    # Verify project exists
    cursor = db.execute('SELECT id FROM projects WHERE id = ?', (project_id,))
    if cursor.fetchone() is None:
        return jsonify({'error': 'Project not found'}), 404

    # Delete all chips (polygons cascade)
    db.execute('DELETE FROM chips WHERE project_id = ?', (project_id,))

    # Update project's updated_at timestamp
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute('UPDATE projects SET updated_at = ? WHERE id = ?', (now, project_id))

    db.commit()

    return jsonify({'message': 'Labels cleared successfully'})
