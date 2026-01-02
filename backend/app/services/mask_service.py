"""
Service for generating and serving target masks for positive chips.
Masks are saved as GeoTIFFs for ML training and converted to PNG for web display.
"""
import io
import json
import logging
from pathlib import Path
from typing import Optional, List

import numpy as np
import rasterio
from rasterio.features import rasterize
from shapely.geometry import shape
from PIL import Image

from app.config import MASKS_DIR, EXPORTS_DIR


logger = logging.getLogger(__name__)


def get_chip_geotiff_path(project_id: int, chip_id: str) -> Optional[Path]:
    """
    Get the path to a chip's exported GeoTIFF if it exists.
    """
    path = Path(EXPORTS_DIR) / str(project_id) / f'{chip_id}.tif'
    if path.exists():
        return path
    return None


def get_chip_mask_path(project_id: int, chip_id: str) -> Path:
    """
    Get the path where a chip's mask would be stored.

    Args:
        project_id: Project ID
        chip_id: Chip ID

    Returns:
        Path to mask GeoTIFF file
    """
    return Path(MASKS_DIR) / str(project_id) / f'{chip_id}.tif'


def generate_mask(project_id: int, chip_id: str, polygon_geometries: List[dict]) -> Optional[Path]:
    """
    Generate a binary mask GeoTIFF for a chip from polygon geometries.

    The mask has the same CRS, transform, and dimensions as the source GeoTIFF,
    making it suitable for ML training alongside the imagery.

    Args:
        project_id: Project ID
        chip_id: Chip ID
        polygon_geometries: List of GeoJSON geometry dicts (in EPSG:4326)

    Returns:
        Path to generated mask, or None if source GeoTIFF doesn't exist
    """
    geotiff_path = get_chip_geotiff_path(project_id, chip_id)
    if geotiff_path is None:
        return None

    # Ensure masks directory exists
    mask_dir = Path(MASKS_DIR) / str(project_id)
    mask_dir.mkdir(parents=True, exist_ok=True)

    mask_path = get_chip_mask_path(project_id, chip_id)

    # Read source GeoTIFF to get transform, dimensions, and CRS
    with rasterio.open(geotiff_path) as src:
        transform = src.transform
        width = src.width
        height = src.height
        crs = src.crs

        # Convert GeoJSON to Shapely geometries with rasterize value
        shapes = []
        for geom in polygon_geometries:
            try:
                shapely_geom = shape(geom)
                # Each shape tuple is (geometry, value)
                shapes.append((shapely_geom, 1))
            except Exception as e:
                logger.warning(f"Skipping invalid geometry: {e}")
                continue

        # Generate binary mask using rasterize
        if shapes:
            mask = rasterize(
                shapes=shapes,
                out_shape=(height, width),
                transform=transform,
                fill=0,      # Background value
                dtype=np.uint8,
                all_touched=True  # Include all pixels touched by polygon
            )
        else:
            # No valid polygons - create empty mask
            mask = np.zeros((height, width), dtype=np.uint8)

        # Create output profile matching source (but single band)
        profile = src.profile.copy()
        profile.update(
            count=1,
            dtype='uint8',
            compress='lzw'  # Compress for smaller file size
        )

        # Write mask GeoTIFF
        with rasterio.open(mask_path, 'w', **profile) as dst:
            dst.write(mask, 1)

    logger.info(f"Generated mask for chip {chip_id} at {mask_path}")
    return mask_path


def get_mask_png(project_id: int, chip_id: str) -> Optional[bytes]:
    """
    Get mask as PNG bytes for web display.

    Converts the single-band GeoTIFF mask to a PNG image.
    Values are scaled: 0 -> 0 (black), 1 -> 255 (white).

    Args:
        project_id: Project ID
        chip_id: Chip ID

    Returns:
        PNG bytes, or None if mask doesn't exist
    """
    mask_path = get_chip_mask_path(project_id, chip_id)
    if not mask_path.exists():
        return None

    with rasterio.open(mask_path) as src:
        mask = src.read(1)

    # Scale 0->0, 1->255 for visibility in PNG
    mask_image = (mask * 255).astype(np.uint8)

    # Create PIL image and save to bytes
    image = Image.fromarray(mask_image, mode='L')
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)

    return buffer.getvalue()


def delete_mask(project_id: int, chip_id: str) -> bool:
    """
    Delete a chip's mask file if it exists.

    Args:
        project_id: Project ID
        chip_id: Chip ID

    Returns:
        True if mask was deleted, False if it didn't exist
    """
    mask_path = get_chip_mask_path(project_id, chip_id)
    if mask_path.exists():
        mask_path.unlink()
        return True
    return False


def regenerate_mask_for_chip(project_id: int, chip_id: str) -> Optional[Path]:
    """
    Regenerate mask for a chip based on current polygons in database.

    Args:
        project_id: Project ID
        chip_id: Chip ID

    Returns:
        Path to generated mask, or None if not applicable
    """
    from app.database import get_db

    db = get_db()

    # Check if chip exists and is positive
    chip_row = db.execute(
        'SELECT chip_type FROM chips WHERE id = ? AND project_id = ?',
        (chip_id, project_id)
    ).fetchone()

    if not chip_row or chip_row['chip_type'] != 'positive':
        # Delete any existing mask for non-positive chips
        delete_mask(project_id, chip_id)
        return None

    # Check if GeoTIFF exists
    if get_chip_geotiff_path(project_id, chip_id) is None:
        return None

    # Get current polygons
    polygon_rows = db.execute(
        'SELECT geometry_geojson FROM polygons WHERE chip_id = ?',
        (chip_id,)
    ).fetchall()

    polygon_geometries = [
        json.loads(row['geometry_geojson'])
        for row in polygon_rows
    ]

    return generate_mask(project_id, chip_id, polygon_geometries)


def regenerate_all_masks_for_project(project_id: int) -> int:
    """
    Regenerate all masks for a project.

    Call this after labels are saved to ensure masks are up-to-date.
    Only regenerates masks for positive chips that have exported imagery.

    Args:
        project_id: Project ID

    Returns:
        Number of masks generated
    """
    from app.database import get_db

    db = get_db()

    # Get all positive chips
    chip_rows = db.execute(
        '''SELECT id FROM chips
           WHERE project_id = ? AND chip_type = 'positive' ''',
        (project_id,)
    ).fetchall()

    count = 0
    for chip_row in chip_rows:
        chip_id = chip_row['id']

        # Only regenerate if GeoTIFF exists
        if get_chip_geotiff_path(project_id, chip_id) is None:
            continue

        # Get polygons for this chip
        polygon_rows = db.execute(
            'SELECT geometry_geojson FROM polygons WHERE chip_id = ?',
            (chip_id,)
        ).fetchall()

        polygon_geometries = [
            json.loads(row['geometry_geojson'])
            for row in polygon_rows
        ]

        if generate_mask(project_id, chip_id, polygon_geometries):
            count += 1

    logger.info(f"Regenerated {count} masks for project {project_id}")
    return count
