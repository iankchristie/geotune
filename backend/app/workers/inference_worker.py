"""
Background worker for inference jobs.
Runs inference in a separate thread and updates job status in database.
"""
import json
import logging
import threading
import queue
from datetime import datetime

from app.config import INFERENCE_DIR

logger = logging.getLogger(__name__)

# Inference queue: (job_id, project_id, bounds, checkpoint_path)
_inference_queue = queue.Queue()

# Currently running job ID (only one at a time per project)
_current_job_id = None
_job_lock = threading.Lock()


def get_current_inference_job() -> int | None:
    """Get the ID of the currently running inference job."""
    with _job_lock:
        return _current_job_id


def queue_inference_job(job_id: int, project_id: int, bounds: dict, checkpoint_path: str):
    """Add an inference job to the queue."""
    _inference_queue.put((job_id, project_id, bounds, checkpoint_path))
    logger.info(f"Queued inference job {job_id} for project {project_id}")


def cancel_inference_job(job_id: int) -> bool:
    """
    Cancel an inference job.

    Returns True if job was cancelled, False if not found or already running.
    Note: Cannot cancel a job that's already running.
    """
    from flask import current_app
    from app.database import get_db

    try:
        with current_app.app_context():
            db = get_db()
            result = db.execute(
                '''UPDATE inference_jobs
                   SET status = 'cancelled'
                   WHERE id = ? AND status = 'pending' ''',
                (job_id,)
            )
            db.commit()
            return result.rowcount > 0
    except Exception as e:
        logger.error(f"Error cancelling inference job {job_id}: {e}")
        return False


class InferenceWorker:
    """Background worker that runs inference jobs."""

    def __init__(self, app):
        self.app = app
        self._stop_event = threading.Event()
        self._thread = None

    def start(self):
        """Start the background worker thread."""
        if self._thread is not None:
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info("Inference worker started")

    def stop(self):
        """Stop the background worker."""
        if self._thread is None:
            return

        self._stop_event.set()
        self._thread.join(timeout=60)
        self._thread = None
        logger.info("Inference worker stopped")

    def _run(self):
        """Main worker loop."""
        global _current_job_id

        while not self._stop_event.is_set():
            try:
                # Wait for items in queue with timeout
                try:
                    job_id, project_id, bounds, checkpoint_path = _inference_queue.get(timeout=5)
                except queue.Empty:
                    continue

                # Process the inference job
                with self.app.app_context():
                    self._run_inference_job(job_id, project_id, bounds, checkpoint_path)

            except Exception as e:
                logger.exception(f"Error in inference worker: {e}")

    def _run_inference_job(self, job_id: int, project_id: int, bounds: dict, checkpoint_path: str):
        """Run a single inference job."""
        global _current_job_id
        from app.database import get_db
        from app.services.inference_service import run_inference

        db = get_db()

        # Check if job was cancelled while in queue
        job = db.execute(
            'SELECT status FROM inference_jobs WHERE id = ?',
            (job_id,)
        ).fetchone()

        if not job or job['status'] == 'cancelled':
            logger.info(f"Inference job {job_id} was cancelled")
            return

        # Mark as downloading
        with _job_lock:
            _current_job_id = job_id

        db.execute(
            '''UPDATE inference_jobs
               SET status = 'downloading', progress = 0, progress_message = 'Starting...'
               WHERE id = ?''',
            (job_id,)
        )
        db.commit()

        logger.info(f"Starting inference job {job_id} for project {project_id}")

        try:
            def progress_callback(progress: float, message: str):
                """Update job progress in database."""
                try:
                    with self.app.app_context():
                        db = get_db()
                        # Update status based on progress
                        status = 'downloading' if progress < 50 else 'inferring'
                        db.execute(
                            '''UPDATE inference_jobs
                               SET status = ?, progress = ?, progress_message = ?
                               WHERE id = ?''',
                            (status, progress, message, job_id)
                        )
                        db.commit()
                        logger.info(f"Job {job_id}: {progress:.1f}% - {message}")
                except Exception as e:
                    logger.warning(f"Failed to update progress: {e}")

            # Run inference
            result = run_inference(
                project_id=project_id,
                job_id=job_id,
                bounds=bounds,
                checkpoint_path=checkpoint_path,
                progress_callback=progress_callback,
            )

            # Mark as completed
            now = datetime.utcnow().isoformat()
            db.execute(
                '''UPDATE inference_jobs
                   SET status = 'completed',
                       completed_at = ?,
                       progress = 100,
                       progress_message = 'Inference complete',
                       output_path = ?
                   WHERE id = ?''',
                (now, result['overlay_png'], job_id)
            )
            db.commit()

            logger.info(f"Inference job {job_id} completed. Output: {result['overlay_png']}")

        except Exception as e:
            logger.exception(f"Inference job {job_id} failed: {e}")

            # Mark as failed
            now = datetime.utcnow().isoformat()
            db.execute(
                '''UPDATE inference_jobs
                   SET status = 'failed',
                       completed_at = ?,
                       error_message = ?
                   WHERE id = ?''',
                (now, str(e), job_id)
            )
            db.commit()

        finally:
            with _job_lock:
                _current_job_id = None


# Module-level worker instance
_worker_instance = None


def start_inference_worker(app):
    """Start the inference worker with the Flask app context."""
    global _worker_instance
    if _worker_instance is None:
        _worker_instance = InferenceWorker(app)
        _worker_instance.start()
    return _worker_instance


def stop_inference_worker():
    """Stop the inference worker."""
    global _worker_instance
    if _worker_instance is not None:
        _worker_instance.stop()
        _worker_instance = None
