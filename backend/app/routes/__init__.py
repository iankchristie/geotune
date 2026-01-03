from app.routes.projects import projects_bp
from app.routes.labels import labels_bp
from app.routes.exports import exports_bp
from app.routes.chips import chips_bp
from app.routes.training import training_bp


def register_blueprints(app):
    """Register all blueprints with the Flask app."""
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(labels_bp, url_prefix='/api')
    app.register_blueprint(exports_bp, url_prefix='/api')
    app.register_blueprint(chips_bp, url_prefix='/api')
    app.register_blueprint(training_bp, url_prefix='/api')

    # Health check endpoint
    @app.route('/api/health')
    def health():
        return {'status': 'healthy', 'database': 'connected'}
