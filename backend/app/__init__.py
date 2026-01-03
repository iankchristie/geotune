import os
from flask import Flask
from flask_cors import CORS
from app.config import CORS_ORIGINS


def create_app():
    """Flask application factory."""
    app = Flask(__name__)

    # Enable CORS for frontend
    CORS(app, origins=CORS_ORIGINS)

    # Initialize database
    from app import database
    database.init_app(app)

    # Register blueprints
    from app.routes import register_blueprints
    register_blueprints(app)

    # Start background workers (only in main process, not reloader)
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        from app.workers.export_worker import start_export_worker
        from app.workers.training_worker import start_training_worker
        start_export_worker(app)
        start_training_worker(app)

    return app
