"""
Service for reading and converting exported GeoTIFF imagery.
"""
import io
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
from PIL import Image

from app.config import EXPORTS_DIR


# Band indices in the exported GeoTIFF (1-indexed for rasterio)
# Order matches DEFAULT_BANDS in gee_service.py: B2, B3, B4, B5, B6, B7, B8, B8A, B11, B12
BAND_INDICES = {
    'B2': 1,   # Blue
    'B3': 2,   # Green
    'B4': 3,   # Red
    'B5': 4,
    'B6': 5,
    'B7': 6,
    'B8': 7,
    'B8A': 8,
    'B11': 9,
    'B12': 10,
}


def get_chip_geotiff_path(project_id: int, chip_id: str) -> Optional[Path]:
    """
    Get the path to a chip's exported GeoTIFF if it exists.

    Args:
        project_id: Project ID
        chip_id: Chip ID

    Returns:
        Path to GeoTIFF file, or None if not exported
    """
    path = Path(EXPORTS_DIR) / str(project_id) / f'{chip_id}.tif'
    if path.exists():
        return path
    return None


def geotiff_to_rgb_png(geotiff_path: Path, max_value: int = 3000) -> bytes:
    """
    Convert a multi-band GeoTIFF to RGB PNG bytes.

    Args:
        geotiff_path: Path to the GeoTIFF file
        max_value: Maximum reflectance value for scaling (default 3000)

    Returns:
        PNG image as bytes
    """
    with rasterio.open(geotiff_path) as src:
        # Read RGB bands (B4=Red, B3=Green, B2=Blue)
        red = src.read(BAND_INDICES['B4'])
        green = src.read(BAND_INDICES['B3'])
        blue = src.read(BAND_INDICES['B2'])

    # Stack into RGB array (height, width, 3)
    rgb = np.stack([red, green, blue], axis=-1).astype(np.float32)

    # Scale to 0-255 range with gamma correction
    rgb = np.clip(rgb, 0, max_value)
    rgb = (rgb / max_value) ** (1 / 1.4)  # gamma = 1.4
    rgb = (rgb * 255).astype(np.uint8)

    # Create PIL image
    image = Image.fromarray(rgb, mode='RGB')

    # Save to bytes
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)

    return buffer.getvalue()


def get_chip_thumbnail(project_id: int, chip_id: str) -> Optional[bytes]:
    """
    Get RGB thumbnail PNG for an exported chip.

    Args:
        project_id: Project ID
        chip_id: Chip ID

    Returns:
        PNG bytes, or None if chip hasn't been exported
    """
    geotiff_path = get_chip_geotiff_path(project_id, chip_id)
    if geotiff_path is None:
        return None

    return geotiff_to_rgb_png(geotiff_path)


def get_chip_metadata(project_id: int, chip_id: str) -> Optional[dict]:
    """
    Get metadata from an exported chip's GeoTIFF.

    Args:
        project_id: Project ID
        chip_id: Chip ID

    Returns:
        Dictionary with metadata, or None if chip hasn't been exported
    """
    geotiff_path = get_chip_geotiff_path(project_id, chip_id)
    if geotiff_path is None:
        return None

    with rasterio.open(geotiff_path) as src:
        bounds = src.bounds  # BoundingBox(left, bottom, right, top)
        width = src.width
        height = src.height
        crs = src.crs.to_string() if src.crs else None
        transform = src.transform

        # Calculate pixel resolution in meters (approximate)
        # transform.a is pixel width, transform.e is pixel height (negative)
        pixel_width = abs(transform.a)
        pixel_height = abs(transform.e)

        # Calculate area in square meters
        # For geographic CRS (degrees), we need to convert
        if crs and 'EPSG:4326' in crs:
            # Approximate conversion at the center latitude
            center_lat = (bounds.bottom + bounds.top) / 2
            import math
            meters_per_degree_lat = 111320
            meters_per_degree_lng = 111320 * math.cos(math.radians(center_lat))

            width_meters = (bounds.right - bounds.left) * meters_per_degree_lng
            height_meters = (bounds.top - bounds.bottom) * meters_per_degree_lat
            area_sq_meters = width_meters * height_meters
            area_sq_km = area_sq_meters / 1_000_000

            resolution_x = pixel_width * meters_per_degree_lng
            resolution_y = pixel_height * meters_per_degree_lat
        else:
            # Assume projected CRS in meters
            width_meters = (bounds.right - bounds.left)
            height_meters = (bounds.top - bounds.bottom)
            area_sq_meters = width_meters * height_meters
            area_sq_km = area_sq_meters / 1_000_000
            resolution_x = pixel_width
            resolution_y = pixel_height

        return {
            'bounds': {
                'west': bounds.left,
                'south': bounds.bottom,
                'east': bounds.right,
                'north': bounds.top,
            },
            'dimensions': {
                'width': width,
                'height': height,
                'widthMeters': round(width_meters, 2),
                'heightMeters': round(height_meters, 2),
                'areaSqKm': round(area_sq_km, 4),
            },
            'resolution': {
                'x': round(resolution_x, 2),
                'y': round(resolution_y, 2),
            },
            'crs': crs,
            'bandCount': src.count,
        }
