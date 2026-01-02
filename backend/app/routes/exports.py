"""
API endpoints for imagery export status.
Downloads happen automatically when labels are saved.
"""
from flask import Blueprint, jsonify
from app.database import get_db
from app.workers.export_worker import get_project_download_status

exports_bp = Blueprint('exports', __name__)


@exports_bp.route('/projects/<int:project_id>/imagery', methods=['GET'])
def get_imagery_status(project_id):
    """
    Get download status for all chips in a project.

    Returns:
    {
        "totalChips": 10,
        "downloadedChips": 5,
        "downloadingChips": 2,
        "pendingChips": 3,
        "chips": [
            {"chipId": "chip-1", "status": "completed", "type": "positive"},
            {"chipId": "chip-2", "status": "downloading", "type": "negative"},
            ...
        ]
    }
    """
    db = get_db()

    # Verify project exists
    cursor = db.execute('SELECT id FROM projects WHERE id = ?', (project_id,))
    if cursor.fetchone() is None:
        return jsonify({'error': 'Project not found'}), 404

    # Get all chips for this project
    cursor = db.execute(
        '''SELECT id, chip_type, center_lng, center_lat
           FROM chips WHERE project_id = ?''',
        (project_id,)
    )

    chip_rows = cursor.fetchall()
    chip_ids = [row['id'] for row in chip_rows]

    # Get download status for all chips
    status_map = get_project_download_status(project_id, chip_ids)

    chips = []
    downloaded_count = 0
    downloading_count = 0
    pending_count = 0
    failed_count = 0

    for row in chip_rows:
        chip_id = row['id']
        status = status_map.get(chip_id, 'pending')

        if status == 'completed':
            downloaded_count += 1
        elif status == 'downloading':
            downloading_count += 1
        elif status == 'failed':
            failed_count += 1
        else:
            pending_count += 1

        chips.append({
            'chipId': chip_id,
            'status': status,
            'type': row['chip_type'],
            'center': {'lng': row['center_lng'], 'lat': row['center_lat']},
        })

    return jsonify({
        'totalChips': len(chips),
        'downloadedChips': downloaded_count,
        'downloadingChips': downloading_count,
        'pendingChips': pending_count,
        'failedChips': failed_count,
        'chips': chips,
    })
