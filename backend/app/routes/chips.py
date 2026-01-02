"""
API routes for chip-related operations.
"""
from flask import Blueprint, jsonify, Response

from app.database import get_db
from app.services.imagery_service import get_chip_thumbnail, get_chip_metadata
from app.services.mask_service import get_mask_png, get_chip_mask_path


chips_bp = Blueprint('chips', __name__)


@chips_bp.route('/chips/<chip_id>/thumbnail', methods=['GET'])
def get_chip_thumbnail_route(chip_id):
    """
    Get RGB thumbnail PNG for an exported chip.

    Returns the thumbnail image directly as PNG bytes.
    Returns 404 if chip doesn't exist or hasn't been exported.
    """
    db = get_db()

    # Get chip and its project from database
    chip = db.execute(
        'SELECT id, project_id FROM chips WHERE id = ?',
        (chip_id,)
    ).fetchone()

    if not chip:
        return jsonify({'error': 'Chip not found'}), 404

    # Try to get thumbnail from exported GeoTIFF
    png_bytes = get_chip_thumbnail(chip['project_id'], chip_id)

    if png_bytes is None:
        return jsonify({
            'error': 'Chip has not been exported yet',
            'exported': False
        }), 404

    return Response(png_bytes, mimetype='image/png')


@chips_bp.route('/chips/<chip_id>/mask', methods=['GET'])
def get_chip_mask_route(chip_id):
    """
    Get binary mask PNG for a positive chip.

    Returns the mask image as PNG bytes (0=black, 255=white).
    Returns 404 if chip doesn't exist, isn't positive, or mask hasn't been generated.
    """
    db = get_db()

    # Get chip and verify it exists
    chip = db.execute(
        'SELECT id, project_id, chip_type FROM chips WHERE id = ?',
        (chip_id,)
    ).fetchone()

    if not chip:
        return jsonify({'error': 'Chip not found'}), 404

    if chip['chip_type'] != 'positive':
        return jsonify({'error': 'Masks are only available for positive chips'}), 404

    # Try to get mask PNG
    png_bytes = get_mask_png(chip['project_id'], chip_id)

    if png_bytes is None:
        return jsonify({
            'error': 'Mask has not been generated yet',
            'generated': False
        }), 404

    return Response(png_bytes, mimetype='image/png')


@chips_bp.route('/chips/<chip_id>/mask', methods=['HEAD'])
def check_chip_mask_exists(chip_id):
    """
    Check if a mask exists for a chip.

    Returns 200 if mask exists, 404 otherwise.
    """
    db = get_db()

    chip = db.execute(
        'SELECT id, project_id, chip_type FROM chips WHERE id = ?',
        (chip_id,)
    ).fetchone()

    if not chip or chip['chip_type'] != 'positive':
        return '', 404

    mask_path = get_chip_mask_path(chip['project_id'], chip_id)
    if mask_path.exists():
        return '', 200

    return '', 404


@chips_bp.route('/chips/<chip_id>/metadata', methods=['GET'])
def get_chip_metadata_route(chip_id):
    """
    Get metadata from an exported chip's GeoTIFF.

    Returns bounds, dimensions, resolution, CRS, and band count.
    Returns 404 if chip doesn't exist or hasn't been exported.
    """
    db = get_db()

    # Get chip and its project from database
    chip = db.execute(
        'SELECT id, project_id FROM chips WHERE id = ?',
        (chip_id,)
    ).fetchone()

    if not chip:
        return jsonify({'error': 'Chip not found'}), 404

    # Try to get metadata from exported GeoTIFF
    metadata = get_chip_metadata(chip['project_id'], chip_id)

    if metadata is None:
        return jsonify({
            'error': 'Chip has not been exported yet',
            'exported': False
        }), 404

    return jsonify(metadata)
