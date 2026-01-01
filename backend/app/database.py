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

        -- Indexes for efficient lookups
        CREATE INDEX IF NOT EXISTS idx_chips_project_id ON chips(project_id);
        CREATE INDEX IF NOT EXISTS idx_polygons_chip_id ON polygons(chip_id);
    ''')

    db.commit()


def init_app(app):
    """Register database functions with Flask app."""
    app.teardown_appcontext(close_db)

    with app.app_context():
        init_db()
