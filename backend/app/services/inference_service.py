"""Inference service for running model predictions on regions."""

import json
import os
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np
import rasterio
import torch
from PIL import Image
from rasterio.transform import from_bounds
from torchgeo.trainers import SemanticSegmentationTask

from app.config import EXPORTS_DIR, INFERENCE_DIR, MODELS_DIR
from app.services.gee_service import DEFAULT_BANDS, get_gee_service


# Tile configuration
TILE_SIZE = 256  # pixels
TILE_OVERLAP = 0.5  # 50% overlap
TILE_STRIDE = int(TILE_SIZE * (1 - TILE_OVERLAP))  # 128 pixel stride


def generate_tile_grid(
    bounds: Dict[str, float],
    resolution: float = 10.0
) -> List[Dict]:
    """Generate a grid of tiles covering the bounding box with overlap.

    Args:
        bounds: Dict with 'west', 'south', 'east', 'north' in degrees
        resolution: Pixel resolution in meters (default 10m for Sentinel-2)

    Returns:
        List of tile dictionaries with 'id', 'bounds', 'geometry'
    """
    west, south, east, north = bounds['west'], bounds['south'], bounds['east'], bounds['north']

    # Calculate approximate degrees per pixel at this latitude
    # At equator: 1 degree ≈ 111,320 meters
    avg_lat = (south + north) / 2
    meters_per_deg_lat = 111320
    meters_per_deg_lng = 111320 * np.cos(np.radians(avg_lat))

    # Tile size in degrees
    tile_height_deg = (TILE_SIZE * resolution) / meters_per_deg_lat
    tile_width_deg = (TILE_SIZE * resolution) / meters_per_deg_lng

    # Stride in degrees (50% overlap)
    stride_height_deg = tile_height_deg * (1 - TILE_OVERLAP)
    stride_width_deg = tile_width_deg * (1 - TILE_OVERLAP)

    tiles = []
    tile_idx = 0
    y = south

    while y < north:
        x = west
        while x < east:
            # Tile bounds
            tile_west = x
            tile_south = y
            tile_east = min(x + tile_width_deg, east + tile_width_deg)
            tile_north = min(y + tile_height_deg, north + tile_height_deg)

            tile_bounds = {
                'west': tile_west,
                'south': tile_south,
                'east': tile_east,
                'north': tile_north,
            }

            # Create GeoJSON polygon for GEE
            geometry = {
                'type': 'Polygon',
                'coordinates': [[
                    [tile_west, tile_south],
                    [tile_east, tile_south],
                    [tile_east, tile_north],
                    [tile_west, tile_north],
                    [tile_west, tile_south],
                ]]
            }

            tiles.append({
                'id': f'tile_{tile_idx}',
                'bounds': tile_bounds,
                'geometry': geometry,
                'col': int((x - west) / stride_width_deg),
                'row': int((y - south) / stride_height_deg),
            })

            tile_idx += 1
            x += stride_width_deg

        y += stride_height_deg

    return tiles


def create_blend_weights(size: int = TILE_SIZE) -> np.ndarray:
    """Create distance-weighted blending weights for a tile.

    Weights are highest in center and fall off towards edges using
    a cosine window function for smooth blending.

    Args:
        size: Tile size in pixels

    Returns:
        2D numpy array of weights
    """
    # Create 1D cosine window
    x = np.linspace(0, np.pi, size)
    window_1d = np.sin(x)  # 0 at edges, 1 at center

    # Create 2D window by outer product
    weights = np.outer(window_1d, window_1d)

    return weights.astype(np.float32)


def load_model(checkpoint_path: str) -> SemanticSegmentationTask:
    """Load a trained model from checkpoint.

    Args:
        checkpoint_path: Path to .ckpt file

    Returns:
        Loaded SemanticSegmentationTask model
    """
    task = SemanticSegmentationTask.load_from_checkpoint(
        checkpoint_path,
        map_location='cpu',
    )
    task.eval()
    return task


def run_inference_on_tile(
    model: SemanticSegmentationTask,
    tile_path: str,
) -> np.ndarray:
    """Run inference on a single tile.

    Args:
        model: Loaded model
        tile_path: Path to GeoTIFF file

    Returns:
        2D numpy array of probabilities (0-1)
    """
    with rasterio.open(tile_path) as src:
        # Read all bands
        image = src.read()  # Shape: (bands, height, width)

    # Convert to tensor
    image_tensor = torch.from_numpy(image.astype(np.float32))
    image_tensor = image_tensor.unsqueeze(0)  # Add batch dimension

    # Normalize (Sentinel-2 surface reflectance values)
    image_tensor = image_tensor / 10000.0

    # Run inference
    with torch.no_grad():
        output = model(image_tensor)

    # Get probabilities (sigmoid for binary segmentation)
    probs = torch.sigmoid(output).squeeze().numpy()

    return probs


def blend_tiles(
    tiles: List[Dict],
    predictions: Dict[str, np.ndarray],
    output_bounds: Dict[str, float],
    resolution: float = 10.0,
) -> Tuple[np.ndarray, Dict]:
    """Blend tile predictions into a single probability map.

    Args:
        tiles: List of tile dictionaries
        predictions: Dict mapping tile_id to probability array
        output_bounds: Full region bounds
        resolution: Pixel resolution in meters

    Returns:
        Tuple of (probability_array, rasterio_profile)
    """
    west, south, east, north = (
        output_bounds['west'],
        output_bounds['south'],
        output_bounds['east'],
        output_bounds['north'],
    )

    # Calculate output dimensions
    avg_lat = (south + north) / 2
    meters_per_deg_lat = 111320
    meters_per_deg_lng = 111320 * np.cos(np.radians(avg_lat))

    height_deg = north - south
    width_deg = east - west

    height_m = height_deg * meters_per_deg_lat
    width_m = width_deg * meters_per_deg_lng

    output_height = int(np.ceil(height_m / resolution))
    output_width = int(np.ceil(width_m / resolution))

    # Create output arrays for weighted accumulation
    prob_sum = np.zeros((output_height, output_width), dtype=np.float64)
    weight_sum = np.zeros((output_height, output_width), dtype=np.float64)

    # Create blend weights
    blend_weights = create_blend_weights(TILE_SIZE)

    for tile in tiles:
        tile_id = tile['id']
        if tile_id not in predictions:
            continue

        pred = predictions[tile_id]
        tile_bounds = tile['bounds']

        # Calculate pixel coordinates for this tile in output
        tile_west_frac = (tile_bounds['west'] - west) / width_deg
        tile_south_frac = (tile_bounds['south'] - south) / height_deg
        tile_east_frac = (tile_bounds['east'] - west) / width_deg
        tile_north_frac = (tile_bounds['north'] - south) / height_deg

        # Convert to pixel coordinates (note: y is flipped for raster)
        col_start = int(tile_west_frac * output_width)
        col_end = int(tile_east_frac * output_width)
        row_start = int((1 - tile_north_frac) * output_height)
        row_end = int((1 - tile_south_frac) * output_height)

        # Ensure bounds are valid
        col_start = max(0, col_start)
        col_end = min(output_width, col_end)
        row_start = max(0, row_start)
        row_end = min(output_height, row_end)

        # Calculate output tile dimensions
        out_height = row_end - row_start
        out_width = col_end - col_start

        if out_height <= 0 or out_width <= 0:
            continue

        # Resize prediction and weights to match output area
        from PIL import Image as PILImage
        pred_resized = np.array(
            PILImage.fromarray(pred).resize((out_width, out_height), PILImage.BILINEAR)
        )
        weights_resized = np.array(
            PILImage.fromarray(blend_weights).resize((out_width, out_height), PILImage.BILINEAR)
        )

        # Accumulate weighted predictions
        prob_sum[row_start:row_end, col_start:col_end] += pred_resized * weights_resized
        weight_sum[row_start:row_end, col_start:col_end] += weights_resized

    # Avoid division by zero
    weight_sum = np.maximum(weight_sum, 1e-10)

    # Compute final blended probability map
    probability_map = (prob_sum / weight_sum).astype(np.float32)

    # Create rasterio profile
    transform = from_bounds(west, south, east, north, output_width, output_height)
    profile = {
        'driver': 'GTiff',
        'dtype': 'float32',
        'width': output_width,
        'height': output_height,
        'count': 1,
        'crs': 'EPSG:4326',
        'transform': transform,
        'compress': 'lzw',
    }

    return probability_map, profile


def probability_to_rgb(probability: np.ndarray) -> np.ndarray:
    """Convert probability map to RGB image with blue→red gradient.

    Args:
        probability: 2D array of probabilities (0-1)

    Returns:
        3D array (height, width, 4) with RGBA values
    """
    height, width = probability.shape

    # Create RGBA output
    rgba = np.zeros((height, width, 4), dtype=np.uint8)

    # Blue (0%) → Purple (50%) → Red (100%)
    # Blue: (0, 0, 255)
    # Purple: (128, 0, 128)
    # Red: (255, 0, 0)

    # Interpolate colors
    prob = np.clip(probability, 0, 1)

    # Red channel: 0→128→255
    rgba[:, :, 0] = (prob * 255).astype(np.uint8)

    # Green channel: 0 throughout
    rgba[:, :, 1] = 0

    # Blue channel: 255→128→0
    rgba[:, :, 2] = ((1 - prob) * 255).astype(np.uint8)

    # Alpha channel: 50% opacity (128)
    rgba[:, :, 3] = 128

    return rgba


def save_probability_geotiff(
    probability: np.ndarray,
    profile: Dict,
    output_path: str
) -> str:
    """Save probability map as GeoTIFF.

    Args:
        probability: 2D probability array
        profile: Rasterio profile dict
        output_path: Output file path

    Returns:
        Output file path
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with rasterio.open(output_path, 'w', **profile) as dst:
        dst.write(probability, 1)

    return output_path


def save_overlay_png(
    probability: np.ndarray,
    output_path: str
) -> str:
    """Save probability overlay as PNG with transparency.

    Args:
        probability: 2D probability array
        output_path: Output file path

    Returns:
        Output file path
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    rgba = probability_to_rgb(probability)
    img = Image.fromarray(rgba, mode='RGBA')
    img.save(output_path, 'PNG')

    return output_path


def get_latest_model_checkpoint(project_id: int) -> Optional[str]:
    """Get the most recent completed training job's checkpoint.

    Args:
        project_id: Project ID

    Returns:
        Path to checkpoint file, or None if no completed training
    """
    from flask import current_app
    from app.database import get_db

    with current_app.app_context():
        db = get_db()
        cursor = db.execute('''
            SELECT checkpoint_path FROM training_jobs
            WHERE project_id = ? AND status = 'completed' AND checkpoint_path IS NOT NULL
            ORDER BY completed_at DESC
            LIMIT 1
        ''', (project_id,))
        row = cursor.fetchone()

    if row and row['checkpoint_path']:
        checkpoint_path = row['checkpoint_path']
        if os.path.exists(checkpoint_path):
            return checkpoint_path

    return None


def get_inference_output_dir(project_id: int, job_id: int) -> Path:
    """Get output directory for an inference job."""
    return Path(INFERENCE_DIR) / str(project_id) / str(job_id)


def run_inference(
    project_id: int,
    job_id: int,
    bounds: Dict[str, float],
    checkpoint_path: str,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> Dict:
    """Run inference on a region.

    Args:
        project_id: Project ID
        job_id: Inference job ID
        bounds: Region bounds (west, south, east, north)
        checkpoint_path: Path to model checkpoint
        progress_callback: Callback(progress_pct, message) for progress updates

    Returns:
        Dict with output paths and metadata
    """
    output_dir = get_inference_output_dir(project_id, job_id)
    tiles_dir = output_dir / 'tiles'
    tiles_dir.mkdir(parents=True, exist_ok=True)

    # Generate tile grid
    tiles = generate_tile_grid(bounds)
    total_tiles = len(tiles)

    if progress_callback:
        progress_callback(0, f'Generated {total_tiles} tiles for inference')

    # Download tiles from GEE
    gee = get_gee_service()
    downloaded_tiles = []

    for i, tile in enumerate(tiles):
        if progress_callback:
            pct = (i / total_tiles) * 50  # First 50% is downloading
            progress_callback(pct, f'Downloading tile {i+1}/{total_tiles}')

        try:
            tile_path = tiles_dir / f"{tile['id']}.tif"

            # Download if not already exists
            if not tile_path.exists():
                gee.download_chip(
                    chip_id=tile['id'],
                    project_id=project_id,
                    geometry=tile['geometry'],
                    start_date='2025-01-01',
                    end_date='2025-12-31',
                    bands=DEFAULT_BANDS,
                    cloud_cover_max=30,
                    scale=10,
                )
                # Move from exports to inference tiles dir
                export_path = Path(EXPORTS_DIR) / str(project_id) / f"{tile['id']}.tif"
                if export_path.exists():
                    export_path.rename(tile_path)

            tile['local_path'] = str(tile_path)
            downloaded_tiles.append(tile)

        except Exception as e:
            print(f"Warning: Failed to download tile {tile['id']}: {e}")
            continue

    if not downloaded_tiles:
        raise ValueError("Failed to download any tiles")

    # Load model
    if progress_callback:
        progress_callback(50, 'Loading model...')

    model = load_model(checkpoint_path)

    # Run inference on each tile
    predictions = {}
    for i, tile in enumerate(downloaded_tiles):
        if progress_callback:
            pct = 50 + (i / len(downloaded_tiles)) * 40  # 50-90% is inference
            progress_callback(pct, f'Running inference on tile {i+1}/{len(downloaded_tiles)}')

        try:
            pred = run_inference_on_tile(model, tile['local_path'])
            predictions[tile['id']] = pred
        except Exception as e:
            print(f"Warning: Failed inference on tile {tile['id']}: {e}")
            continue

    if not predictions:
        raise ValueError("Failed to run inference on any tiles")

    # Blend tiles
    if progress_callback:
        progress_callback(90, 'Blending tiles...')

    probability_map, profile = blend_tiles(tiles, predictions, bounds)

    # Save outputs
    if progress_callback:
        progress_callback(95, 'Saving outputs...')

    prob_tif_path = output_dir / 'probability.tif'
    overlay_png_path = output_dir / 'overlay.png'

    save_probability_geotiff(probability_map, profile, str(prob_tif_path))
    save_overlay_png(probability_map, str(overlay_png_path))

    if progress_callback:
        progress_callback(100, 'Inference complete')

    return {
        'probability_tif': str(prob_tif_path),
        'overlay_png': str(overlay_png_path),
        'bounds': bounds,
        'tile_count': len(downloaded_tiles),
        'width': profile['width'],
        'height': profile['height'],
    }
