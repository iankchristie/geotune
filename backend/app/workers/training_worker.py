"""
Background worker for ML training jobs.
Runs training in a separate thread and updates job status in database.
"""
import json
import logging
import threading
import queue
from datetime import datetime

from app.config import MODELS_DIR
from app.ml.trainer import run_training, TRAINING_CONFIG

logger = logging.getLogger(__name__)

# Training queue: (job_id, project_id)
_training_queue = queue.Queue()

# Currently running job ID (only one at a time)
_current_job_id = None
_job_lock = threading.Lock()


def get_current_training_job() -> int | None:
    """Get the ID of the currently running training job."""
    with _job_lock:
        return _current_job_id


def queue_training_job(job_id: int, project_id: int):
    """Add a training job to the queue."""
    _training_queue.put((job_id, project_id))
    logger.info(f"Queued training job {job_id} for project {project_id}")


def cancel_training_job(job_id: int) -> bool:
    """
    Cancel a training job.

    Returns True if job was cancelled, False if not found or already running.
    Note: Cannot cancel a job that's already training (would need trainer interruption).
    """
    # For now, we can only cancel pending jobs by updating their status
    # Active training jobs would need more complex interruption logic
    from flask import current_app
    from app.database import get_db

    try:
        with current_app.app_context():
            db = get_db()
            result = db.execute(
                '''UPDATE training_jobs
                   SET status = 'cancelled'
                   WHERE id = ? AND status = 'pending' ''',
                (job_id,)
            )
            db.commit()
            return result.rowcount > 0
    except Exception as e:
        logger.error(f"Error cancelling job {job_id}: {e}")
        return False


class TrainingWorker:
    """Background worker that runs ML training jobs."""

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
        logger.info("Training worker started")

    def stop(self):
        """Stop the background worker."""
        if self._thread is None:
            return

        self._stop_event.set()
        self._thread.join(timeout=60)  # Give more time for training to stop
        self._thread = None
        logger.info("Training worker stopped")

    def _run(self):
        """Main worker loop."""
        global _current_job_id

        while not self._stop_event.is_set():
            try:
                # Wait for items in queue with timeout
                try:
                    job_id, project_id = _training_queue.get(timeout=5)
                except queue.Empty:
                    continue

                # Process the training job
                with self.app.app_context():
                    self._run_training_job(job_id, project_id)

            except Exception as e:
                logger.exception(f"Error in training worker: {e}")

    def _run_training_job(self, job_id: int, project_id: int):
        """Run a single training job."""
        global _current_job_id
        from app.database import get_db

        db = get_db()

        # Check if job was cancelled while in queue
        job = db.execute(
            'SELECT status FROM training_jobs WHERE id = ?',
            (job_id,)
        ).fetchone()

        if not job or job['status'] == 'cancelled':
            logger.info(f"Training job {job_id} was cancelled")
            return

        # Mark as running
        with _job_lock:
            _current_job_id = job_id

        now = datetime.utcnow().isoformat()
        db.execute(
            '''UPDATE training_jobs
               SET status = 'running', started_at = ?
               WHERE id = ?''',
            (now, job_id)
        )
        db.commit()

        logger.info(f"Starting training job {job_id} for project {project_id}")

        try:
            def progress_callback(epoch, total_epochs, train_loss, val_loss, val_iou):
                """Update job progress in database."""
                try:
                    with self.app.app_context():
                        db = get_db()
                        db.execute(
                            '''UPDATE training_jobs
                               SET current_epoch = ?,
                                   total_epochs = ?,
                                   train_loss = ?,
                                   val_loss = ?,
                                   val_iou = ?
                               WHERE id = ?''',
                            (epoch, total_epochs, train_loss, val_loss, val_iou, job_id)
                        )
                        db.commit()
                        logger.info(
                            f"Job {job_id} epoch {epoch}/{total_epochs}: "
                            f"train_loss={train_loss:.4f}, val_loss={val_loss:.4f}, val_iou={val_iou:.4f}"
                        )
                except Exception as e:
                    logger.warning(f"Failed to update progress: {e}")

            # Run training
            checkpoint_path = run_training(
                project_id=project_id,
                job_id=job_id,
                progress_callback=progress_callback,
            )

            # Mark as completed
            now = datetime.utcnow().isoformat()
            db.execute(
                '''UPDATE training_jobs
                   SET status = 'completed',
                       completed_at = ?,
                       checkpoint_path = ?
                   WHERE id = ?''',
                (now, checkpoint_path, job_id)
            )
            db.commit()

            logger.info(f"Training job {job_id} completed. Checkpoint: {checkpoint_path}")

        except Exception as e:
            logger.exception(f"Training job {job_id} failed: {e}")

            # Mark as failed
            now = datetime.utcnow().isoformat()
            db.execute(
                '''UPDATE training_jobs
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


def start_training_worker(app):
    """Start the training worker with the Flask app context."""
    global _worker_instance
    if _worker_instance is None:
        _worker_instance = TrainingWorker(app)
        _worker_instance.start()
    return _worker_instance


def stop_training_worker():
    """Stop the training worker."""
    global _worker_instance
    if _worker_instance is not None:
        _worker_instance.stop()
        _worker_instance = None
