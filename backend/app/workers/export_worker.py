"""
Background worker for downloading GEE imagery for chips.
Uses fixed parameters: 2025-01-01 to 2025-12-31, 30% cloud cover.
"""
import json
import logging
import threading
import queue
from pathlib import Path

from app.config import EXPORTS_DIR
from app.services.gee_service import get_gee_service, DEFAULT_BANDS
from app.services.mask_service import generate_mask

logger = logging.getLogger(__name__)

# Fixed export parameters
START_DATE = '2025-01-01'
END_DATE = '2025-12-31'
CLOUD_COVER_MAX = 30

# Download queue: (project_id, chip_id, geometry)
_download_queue = queue.Queue()

# Track download status: {chip_id: 'pending' | 'downloading' | 'completed' | 'failed'}
_download_status = {}
_status_lock = threading.Lock()


def get_chip_file_path(project_id: int, chip_id: str) -> Path:
    """Get the path where a chip's GeoTIFF would be stored."""
    return Path(EXPORTS_DIR) / str(project_id) / f'{chip_id}.tif'


def is_chip_downloaded(project_id: int, chip_id: str) -> bool:
    """Check if a chip has already been downloaded."""
    return get_chip_file_path(project_id, chip_id).exists()


def get_download_status(chip_id: str) -> str:
    """Get the download status of a chip."""
    with _status_lock:
        return _download_status.get(chip_id, 'unknown')


def get_project_download_status(project_id: int, chip_ids: list) -> dict:
    """
    Get download status for all chips in a project.

    Returns dict mapping chip_id to status:
    - 'completed': File exists
    - 'downloading': Currently being downloaded
    - 'pending': In queue
    - 'failed': Download failed
    """
    status = {}
    with _status_lock:
        for chip_id in chip_ids:
            if is_chip_downloaded(project_id, chip_id):
                status[chip_id] = 'completed'
            elif chip_id in _download_status:
                status[chip_id] = _download_status[chip_id]
            else:
                status[chip_id] = 'pending'
    return status


def queue_chip_downloads(project_id: int):
    """
    Queue downloads for all chips in a project that don't have imagery yet.
    Called after labels are saved.
    """
    from app.database import get_db

    db = get_db()
    cursor = db.execute(
        'SELECT id, geometry_geojson FROM chips WHERE project_id = ?',
        (project_id,)
    )

    chips_queued = 0
    for row in cursor.fetchall():
        chip_id = row['id']

        # Skip if already downloaded
        if is_chip_downloaded(project_id, chip_id):
            continue

        # Skip if already in queue or being processed
        with _status_lock:
            if chip_id in _download_status and _download_status[chip_id] in ('pending', 'downloading'):
                continue
            _download_status[chip_id] = 'pending'

        geometry = json.loads(row['geometry_geojson'])
        _download_queue.put((project_id, chip_id, geometry))
        chips_queued += 1

    if chips_queued > 0:
        logger.info(f"Queued {chips_queued} chips for download in project {project_id}")


class ExportWorker:
    """Background worker that downloads GEE imagery for chips."""

    def __init__(self, app):
        self.app = app
        self.gee_service = None
        self._stop_event = threading.Event()
        self._thread = None

    def start(self):
        """Start the background worker thread."""
        if self._thread is not None:
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info("Export worker started")

    def stop(self):
        """Stop the background worker."""
        if self._thread is None:
            return

        self._stop_event.set()
        self._thread.join(timeout=30)
        self._thread = None
        logger.info("Export worker stopped")

    def _run(self):
        """Main worker loop."""
        # Initialize GEE service in worker thread
        try:
            self.gee_service = get_gee_service()
            logger.info("GEE service initialized in worker")
        except Exception as e:
            logger.error(f"Failed to initialize GEE service: {e}")
            logger.warning("Export worker running without GEE - downloads will fail")

        while not self._stop_event.is_set():
            try:
                # Wait for items in queue with timeout
                try:
                    project_id, chip_id, geometry = _download_queue.get(timeout=5)
                except queue.Empty:
                    continue

                # Process the download
                with self.app.app_context():
                    self._download_chip(project_id, chip_id, geometry)

            except Exception as e:
                logger.exception(f"Error in export worker: {e}")

    def _download_chip(self, project_id: int, chip_id: str, geometry: dict):
        """Download a single chip."""
        # Check if already downloaded (could have been downloaded while in queue)
        if is_chip_downloaded(project_id, chip_id):
            with _status_lock:
                _download_status[chip_id] = 'completed'
            return

        # Mark as downloading
        with _status_lock:
            _download_status[chip_id] = 'downloading'

        try:
            if self.gee_service is None:
                raise RuntimeError("GEE service not initialized")

            logger.info(f"Downloading chip {chip_id}")

            local_path = self.gee_service.download_chip(
                chip_id=chip_id,
                project_id=project_id,
                geometry=geometry,
                start_date=START_DATE,
                end_date=END_DATE,
                bands=DEFAULT_BANDS,
                cloud_cover_max=CLOUD_COVER_MAX
            )

            with _status_lock:
                _download_status[chip_id] = 'completed'

            logger.info(f"Chip {chip_id} downloaded to {local_path}")

            # Generate mask for positive chips
            self._generate_chip_mask(project_id, chip_id)

        except Exception as e:
            logger.error(f"Failed to download chip {chip_id}: {e}")
            with _status_lock:
                _download_status[chip_id] = 'failed'

    def _generate_chip_mask(self, project_id: int, chip_id: str):
        """Generate mask for a positive chip after imagery is downloaded."""
        from app.database import get_db

        try:
            db = get_db()

            # Check if chip is positive
            chip_row = db.execute(
                'SELECT chip_type FROM chips WHERE id = ?',
                (chip_id,)
            ).fetchone()

            if not chip_row or chip_row['chip_type'] != 'positive':
                return  # Only generate masks for positive chips

            # Get polygons for this chip
            polygon_rows = db.execute(
                'SELECT geometry_geojson FROM polygons WHERE chip_id = ?',
                (chip_id,)
            ).fetchall()

            if not polygon_rows:
                return  # No polygons to rasterize

            polygon_geometries = [
                json.loads(row['geometry_geojson'])
                for row in polygon_rows
            ]

            mask_path = generate_mask(project_id, chip_id, polygon_geometries)
            if mask_path:
                logger.info(f"Generated mask for chip {chip_id}")

        except Exception as e:
            # Don't fail the overall download for mask generation failure
            logger.warning(f"Failed to generate mask for chip {chip_id}: {e}")


# Module-level worker instance
_worker_instance = None


def start_export_worker(app):
    """Start the export worker with the Flask app context."""
    global _worker_instance
    if _worker_instance is None:
        _worker_instance = ExportWorker(app)
        _worker_instance.start()
    return _worker_instance


def stop_export_worker():
    """Stop the export worker."""
    global _worker_instance
    if _worker_instance is not None:
        _worker_instance.stop()
        _worker_instance = None
