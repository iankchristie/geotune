"""Inference API routes."""
import json
import os
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file

from app.database import get_db
from app.config import INFERENCE_DIR
from app.workers.inference_worker import (
    queue_inference_job,
    cancel_inference_job,
    get_current_inference_job
)

inference_bp = Blueprint('inference', __name__)


@inference_bp.route('/projects/<int:project_id>/inference', methods=['GET'])
def list_inference_jobs(project_id):
    """List all inference jobs for a project."""
    db = get_db()

    jobs = db.execute(
        '''SELECT id, training_job_id, status, bounds_geojson, progress,
                  progress_message, output_path, error_message, created_at, completed_at
           FROM inference_jobs
           WHERE project_id = ?
           ORDER BY created_at DESC''',
        (project_id,)
    ).fetchall()

    return jsonify({
        'jobs': [
            {
                'id': job['id'],
                'training_job_id': job['training_job_id'],
                'status': job['status'],
                'bounds': json.loads(job['bounds_geojson']),
                'progress': job['progress'],
                'progress_message': job['progress_message'],
                'output_path': job['output_path'],
                'error_message': job['error_message'],
                'created_at': job['created_at'],
                'completed_at': job['completed_at'],
            }
            for job in jobs
        ]
    })


@inference_bp.route('/projects/<int:project_id>/inference', methods=['POST'])
def start_inference_job(project_id):
    """Start a new inference job for a project."""
    db = get_db()

    # Check project exists
    project = db.execute(
        'SELECT id FROM projects WHERE id = ?',
        (project_id,)
    ).fetchone()

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Get request data
    data = request.get_json() or {}
    bounds = data.get('bounds')

    if not bounds:
        return jsonify({'error': 'Missing bounds parameter'}), 400

    # Validate bounds
    required_keys = ['west', 'south', 'east', 'north']
    if not all(key in bounds for key in required_keys):
        return jsonify({
            'error': f'Bounds must include: {", ".join(required_keys)}'
        }), 400

    # Check if there's already a running or pending job
    existing = db.execute(
        '''SELECT id, status FROM inference_jobs
           WHERE project_id = ? AND status IN ('pending', 'downloading', 'inferring')''',
        (project_id,)
    ).fetchone()

    if existing:
        return jsonify({
            'error': f'An inference job is already {existing["status"]}',
            'job_id': existing['id']
        }), 409

    # Get the most recent completed training job
    training_job = db.execute(
        '''SELECT id, checkpoint_path FROM training_jobs
           WHERE project_id = ? AND status = 'completed' AND checkpoint_path IS NOT NULL
           ORDER BY completed_at DESC
           LIMIT 1''',
        (project_id,)
    ).fetchone()

    if not training_job:
        return jsonify({
            'error': 'No completed training job found. Train a model first.'
        }), 400

    checkpoint_path = training_job['checkpoint_path']
    if not os.path.exists(checkpoint_path):
        return jsonify({
            'error': 'Model checkpoint not found. Train a new model.'
        }), 400

    # Create inference job
    bounds_json = json.dumps(bounds)
    now = datetime.utcnow().isoformat()

    cursor = db.execute(
        '''INSERT INTO inference_jobs
           (project_id, training_job_id, status, bounds_geojson, created_at)
           VALUES (?, ?, 'pending', ?, ?)''',
        (project_id, training_job['id'], bounds_json, now)
    )
    db.commit()

    job_id = cursor.lastrowid

    # Queue the job
    queue_inference_job(job_id, project_id, bounds, checkpoint_path)

    return jsonify({
        'id': job_id,
        'training_job_id': training_job['id'],
        'status': 'pending',
        'bounds': bounds,
        'progress': 0,
        'progress_message': 'Queued',
        'created_at': now,
    }), 201


@inference_bp.route('/projects/<int:project_id>/inference/<int:job_id>', methods=['GET'])
def get_inference_job(project_id, job_id):
    """Get status and progress for a specific inference job."""
    db = get_db()

    job = db.execute(
        '''SELECT id, training_job_id, status, bounds_geojson, progress,
                  progress_message, output_path, error_message, created_at, completed_at
           FROM inference_jobs
           WHERE id = ? AND project_id = ?''',
        (job_id, project_id)
    ).fetchone()

    if not job:
        return jsonify({'error': 'Inference job not found'}), 404

    return jsonify({
        'id': job['id'],
        'training_job_id': job['training_job_id'],
        'status': job['status'],
        'bounds': json.loads(job['bounds_geojson']),
        'progress': job['progress'],
        'progress_message': job['progress_message'],
        'output_path': job['output_path'],
        'error_message': job['error_message'],
        'created_at': job['created_at'],
        'completed_at': job['completed_at'],
    })


@inference_bp.route('/projects/<int:project_id>/inference/<int:job_id>', methods=['DELETE'])
def cancel_inference(project_id, job_id):
    """Cancel a pending inference job."""
    db = get_db()

    # Check job exists and belongs to project
    job = db.execute(
        '''SELECT id, status FROM inference_jobs
           WHERE id = ? AND project_id = ?''',
        (job_id, project_id)
    ).fetchone()

    if not job:
        return jsonify({'error': 'Inference job not found'}), 404

    if job['status'] not in ('pending', 'downloading', 'inferring'):
        return jsonify({
            'error': f'Cannot cancel job with status: {job["status"]}'
        }), 400

    # Can't cancel running jobs easily
    if job['status'] in ('downloading', 'inferring'):
        return jsonify({
            'error': 'Cannot cancel a running inference job. Wait for it to complete or fail.'
        }), 400

    # Cancel pending job
    db.execute(
        '''UPDATE inference_jobs
           SET status = 'cancelled'
           WHERE id = ?''',
        (job_id,)
    )
    db.commit()

    return jsonify({'message': 'Inference job cancelled'})


@inference_bp.route('/projects/<int:project_id>/inference/<int:job_id>/overlay', methods=['GET'])
def get_inference_overlay(project_id, job_id):
    """Get the probability overlay PNG for a completed inference job."""
    db = get_db()

    job = db.execute(
        '''SELECT status, output_path, bounds_geojson FROM inference_jobs
           WHERE id = ? AND project_id = ?''',
        (job_id, project_id)
    ).fetchone()

    if not job:
        return jsonify({'error': 'Inference job not found'}), 404

    if job['status'] != 'completed':
        return jsonify({
            'error': f'Inference job not completed. Status: {job["status"]}'
        }), 400

    output_path = job['output_path']
    if not output_path or not os.path.exists(output_path):
        return jsonify({'error': 'Overlay file not found'}), 404

    return send_file(
        output_path,
        mimetype='image/png',
        as_attachment=False
    )


@inference_bp.route('/projects/<int:project_id>/inference/<int:job_id>/bounds', methods=['GET'])
def get_inference_bounds(project_id, job_id):
    """Get the bounds for positioning the overlay on the map."""
    db = get_db()

    job = db.execute(
        '''SELECT bounds_geojson FROM inference_jobs
           WHERE id = ? AND project_id = ?''',
        (job_id, project_id)
    ).fetchone()

    if not job:
        return jsonify({'error': 'Inference job not found'}), 404

    return jsonify({
        'bounds': json.loads(job['bounds_geojson'])
    })


@inference_bp.route('/projects/<int:project_id>/inference/latest', methods=['GET'])
def get_latest_inference(project_id):
    """Get the most recent completed inference job for a project."""
    db = get_db()

    job = db.execute(
        '''SELECT id, training_job_id, status, bounds_geojson, progress,
                  progress_message, output_path, error_message, created_at, completed_at
           FROM inference_jobs
           WHERE project_id = ? AND status = 'completed'
           ORDER BY completed_at DESC
           LIMIT 1''',
        (project_id,)
    ).fetchone()

    if not job:
        return jsonify({'error': 'No completed inference jobs found'}), 404

    return jsonify({
        'id': job['id'],
        'training_job_id': job['training_job_id'],
        'status': job['status'],
        'bounds': json.loads(job['bounds_geojson']),
        'progress': job['progress'],
        'progress_message': job['progress_message'],
        'output_path': job['output_path'],
        'error_message': job['error_message'],
        'created_at': job['created_at'],
        'completed_at': job['completed_at'],
    })


@inference_bp.route('/projects/<int:project_id>/has-trained-model', methods=['GET'])
def check_has_trained_model(project_id):
    """Check if the project has a completed training job with a valid model."""
    db = get_db()

    training_job = db.execute(
        '''SELECT id, checkpoint_path FROM training_jobs
           WHERE project_id = ? AND status = 'completed' AND checkpoint_path IS NOT NULL
           ORDER BY completed_at DESC
           LIMIT 1''',
        (project_id,)
    ).fetchone()

    has_model = False
    if training_job and training_job['checkpoint_path']:
        has_model = os.path.exists(training_job['checkpoint_path'])

    return jsonify({
        'has_model': has_model,
        'training_job_id': training_job['id'] if training_job else None
    })
