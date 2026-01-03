import os

# Base directory for the backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Database configuration
DATABASE_PATH = os.environ.get('DATABASE_PATH', os.path.join(BASE_DIR, 'data', 'geolabel.db'))

# CORS configuration
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')

# Google Earth Engine configuration
GEE_SERVICE_ACCOUNT_PATH = os.environ.get(
    'GEE_SERVICE_ACCOUNT_PATH',
    os.path.join(BASE_DIR, 'credentials', 'gee-service-account.json')
)

# Export configuration
EXPORTS_DIR = os.environ.get('EXPORTS_DIR', os.path.join(BASE_DIR, 'data', 'exports'))

# Mask configuration (for ML training target masks)
MASKS_DIR = os.environ.get('MASKS_DIR', os.path.join(BASE_DIR, 'data', 'masks'))

# Models configuration (for ML training checkpoints and logs)
MODELS_DIR = os.environ.get('MODELS_DIR', os.path.join(BASE_DIR, 'data', 'models'))

# Inference configuration (for inference job outputs)
INFERENCE_DIR = os.environ.get('INFERENCE_DIR', os.path.join(BASE_DIR, 'data', 'inference'))
