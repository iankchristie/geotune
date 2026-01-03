"""Training API routes."""
import json
from datetime import datetime

from flask import Blueprint, jsonify, request

from app.database import get_db
from app.ml.trainer import TRAINING_CONFIG
from app.workers.training_worker import queue_training_job, cancel_training_job, get_current_training_job

training_bp = Blueprint('training', __name__)


@training_bp.route('/projects/<int:project_id>/training', methods=['GET'])
def list_training_jobs(project_id):
    """List all training jobs for a project."""
    db = get_db()

    jobs = db.execute(
        '''SELECT id, status, config_json, started_at, completed_at,
                  current_epoch, total_epochs, train_loss, val_loss, val_iou,
                  checkpoint_path, error_message, created_at
           FROM training_jobs
           WHERE project_id = ?
           ORDER BY created_at DESC''',
        (project_id,)
    ).fetchall()

    return jsonify({
        'jobs': [
            {
                'id': job['id'],
                'status': job['status'],
                'config': json.loads(job['config_json']),
                'started_at': job['started_at'],
                'completed_at': job['completed_at'],
                'current_epoch': job['current_epoch'],
                'total_epochs': job['total_epochs'],
                'train_loss': job['train_loss'],
                'val_loss': job['val_loss'],
                'val_iou': job['val_iou'],
                'checkpoint_path': job['checkpoint_path'],
                'error_message': job['error_message'],
                'created_at': job['created_at'],
            }
            for job in jobs
        ]
    })


@training_bp.route('/projects/<int:project_id>/training', methods=['POST'])
def start_training_job(project_id):
    """Start a new training job for a project."""
    db = get_db()

    # Check project exists
    project = db.execute(
        'SELECT id FROM projects WHERE id = ?',
        (project_id,)
    ).fetchone()

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Check if there's already a running or pending job
    existing = db.execute(
        '''SELECT id, status FROM training_jobs
           WHERE project_id = ? AND status IN ('pending', 'running')''',
        (project_id,)
    ).fetchone()

    if existing:
        return jsonify({
            'error': f'A training job is already {existing["status"]}',
            'job_id': existing['id']
        }), 409

    # Check that we have positive chips with masks
    positive_chips = db.execute(
        '''SELECT COUNT(*) as count FROM chips
           WHERE project_id = ? AND chip_type = 'positive' ''',
        (project_id,)
    ).fetchone()

    if positive_chips['count'] == 0:
        return jsonify({
            'error': 'No positive chips found. Add positive labels before training.'
        }), 400

    # Create training job with fixed config
    config_json = json.dumps(TRAINING_CONFIG)
    now = datetime.utcnow().isoformat()

    cursor = db.execute(
        '''INSERT INTO training_jobs
           (project_id, status, config_json, total_epochs, created_at)
           VALUES (?, 'pending', ?, ?, ?)''',
        (project_id, config_json, TRAINING_CONFIG['max_epochs'], now)
    )
    db.commit()

    job_id = cursor.lastrowid

    # Queue the job
    queue_training_job(job_id, project_id)

    return jsonify({
        'id': job_id,
        'status': 'pending',
        'config': TRAINING_CONFIG,
        'total_epochs': TRAINING_CONFIG['max_epochs'],
        'created_at': now,
    }), 201


@training_bp.route('/projects/<int:project_id>/training/<int:job_id>', methods=['GET'])
def get_training_job(project_id, job_id):
    """Get status and metrics for a specific training job."""
    db = get_db()

    job = db.execute(
        '''SELECT id, status, config_json, started_at, completed_at,
                  current_epoch, total_epochs, train_loss, val_loss, val_iou,
                  checkpoint_path, error_message, created_at
           FROM training_jobs
           WHERE id = ? AND project_id = ?''',
        (job_id, project_id)
    ).fetchone()

    if not job:
        return jsonify({'error': 'Training job not found'}), 404

    return jsonify({
        'id': job['id'],
        'status': job['status'],
        'config': json.loads(job['config_json']),
        'started_at': job['started_at'],
        'completed_at': job['completed_at'],
        'current_epoch': job['current_epoch'],
        'total_epochs': job['total_epochs'],
        'train_loss': job['train_loss'],
        'val_loss': job['val_loss'],
        'val_iou': job['val_iou'],
        'checkpoint_path': job['checkpoint_path'],
        'error_message': job['error_message'],
        'created_at': job['created_at'],
    })


@training_bp.route('/projects/<int:project_id>/training/<int:job_id>', methods=['DELETE'])
def cancel_training(project_id, job_id):
    """Cancel a pending training job."""
    db = get_db()

    # Check job exists and belongs to project
    job = db.execute(
        '''SELECT id, status FROM training_jobs
           WHERE id = ? AND project_id = ?''',
        (job_id, project_id)
    ).fetchone()

    if not job:
        return jsonify({'error': 'Training job not found'}), 404

    if job['status'] not in ('pending', 'running'):
        return jsonify({
            'error': f'Cannot cancel job with status: {job["status"]}'
        }), 400

    # Try to cancel
    if job['status'] == 'running':
        # Can't easily cancel running jobs without trainer interruption
        return jsonify({
            'error': 'Cannot cancel a running training job. Wait for it to complete or fail.'
        }), 400

    # Cancel pending job
    db.execute(
        '''UPDATE training_jobs
           SET status = 'cancelled'
           WHERE id = ?''',
        (job_id,)
    )
    db.commit()

    return jsonify({'message': 'Training job cancelled'})


@training_bp.route('/projects/<int:project_id>/training/latest', methods=['GET'])
def get_latest_training(project_id):
    """Get the most recent training job for a project (any status)."""
    db = get_db()

    job = db.execute(
        '''SELECT id, status, config_json, started_at, completed_at,
                  current_epoch, total_epochs, train_loss, val_loss, val_iou,
                  checkpoint_path, error_message, created_at
           FROM training_jobs
           WHERE project_id = ?
           ORDER BY created_at DESC
           LIMIT 1''',
        (project_id,)
    ).fetchone()

    if not job:
        return jsonify({'error': 'No training jobs found'}), 404

    return jsonify({
        'id': job['id'],
        'status': job['status'],
        'config': json.loads(job['config_json']),
        'started_at': job['started_at'],
        'completed_at': job['completed_at'],
        'current_epoch': job['current_epoch'],
        'total_epochs': job['total_epochs'],
        'train_loss': job['train_loss'],
        'val_loss': job['val_loss'],
        'val_iou': job['val_iou'],
        'checkpoint_path': job['checkpoint_path'],
        'error_message': job['error_message'],
        'created_at': job['created_at'],
    })
