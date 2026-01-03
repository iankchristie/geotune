import os
import sqlite3
from flask import g
from app.config import DATABASE_PATH


def get_db():
    """Get database connection for current request."""
    if 'db' not in g:
        # Ensure data directory exists
        os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)

        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
        # Enable foreign key support
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db


def close_db(e=None):
    """Close database connection at end of request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Initialize database with schema."""
    db = get_db()

    db.executescript('''
        -- Projects table
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- Chips table (both positive and negative)
        CREATE TABLE IF NOT EXISTS chips (
            id TEXT PRIMARY KEY,
            project_id INTEGER NOT NULL,
            geometry_geojson TEXT NOT NULL,
            center_lng REAL NOT NULL,
            center_lat REAL NOT NULL,
            chip_type TEXT NOT NULL CHECK (chip_type IN ('positive', 'negative')),
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        -- Polygons table (user-drawn features within positive chips)
        CREATE TABLE IF NOT EXISTS polygons (
            id TEXT PRIMARY KEY,
            chip_id TEXT NOT NULL,
            geometry_geojson TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (chip_id) REFERENCES chips(id) ON DELETE CASCADE
        );

        -- Export jobs table (tracks export requests)
        CREATE TABLE IF NOT EXISTS export_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            bands TEXT NOT NULL,
            cloud_cover_max INTEGER DEFAULT 20,
            total_chips INTEGER NOT NULL,
            completed_chips INTEGER DEFAULT 0,
            failed_chips INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        -- Chip exports table (tracks individual chip export status)
        CREATE TABLE IF NOT EXISTS chip_exports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            chip_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
            local_path TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (job_id) REFERENCES export_jobs(id) ON DELETE CASCADE,
            FOREIGN KEY (chip_id) REFERENCES chips(id) ON DELETE CASCADE
        );

        -- Training jobs table (tracks ML training runs)
        CREATE TABLE IF NOT EXISTS training_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
            config_json TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            current_epoch INTEGER DEFAULT 0,
            total_epochs INTEGER NOT NULL,
            train_loss REAL,
            val_loss REAL,
            val_iou REAL,
            checkpoint_path TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        -- Inference jobs table (tracks inference runs on regions)
        CREATE TABLE IF NOT EXISTS inference_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            training_job_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'downloading', 'inferring', 'completed', 'failed', 'cancelled')),
            bounds_geojson TEXT NOT NULL,
            progress REAL DEFAULT 0,
            progress_message TEXT,
            output_path TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (training_job_id) REFERENCES training_jobs(id) ON DELETE SET NULL
        );

        -- Indexes for efficient lookups
        CREATE INDEX IF NOT EXISTS idx_chips_project_id ON chips(project_id);
        CREATE INDEX IF NOT EXISTS idx_polygons_chip_id ON polygons(chip_id);
        CREATE INDEX IF NOT EXISTS idx_export_jobs_project_id ON export_jobs(project_id);
        CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_chip_exports_job_id ON chip_exports(job_id);
        CREATE INDEX IF NOT EXISTS idx_chip_exports_chip_id ON chip_exports(chip_id);
        CREATE INDEX IF NOT EXISTS idx_training_jobs_project_id ON training_jobs(project_id);
        CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_inference_jobs_project_id ON inference_jobs(project_id);
        CREATE INDEX IF NOT EXISTS idx_inference_jobs_status ON inference_jobs(status);
    ''')

    db.commit()


def init_app(app):
    """Register database functions with Flask app."""
    app.teardown_appcontext(close_db)

    with app.app_context():
        init_db()
