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

    return app
