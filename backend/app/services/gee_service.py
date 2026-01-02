"""
Google Earth Engine service for Sentinel-2 imagery export.
"""
import json
import os
from pathlib import Path
from typing import Dict, List, Optional

import ee
import requests

from app.config import GEE_SERVICE_ACCOUNT_PATH, EXPORTS_DIR


# Sentinel-2 L2A band specifications
SENTINEL2_BANDS = {
    'B2': {'resolution': 10, 'description': 'Blue'},
    'B3': {'resolution': 10, 'description': 'Green'},
    'B4': {'resolution': 10, 'description': 'Red'},
    'B5': {'resolution': 20, 'description': 'Vegetation Red Edge'},
    'B6': {'resolution': 20, 'description': 'Vegetation Red Edge'},
    'B7': {'resolution': 20, 'description': 'Vegetation Red Edge'},
    'B8': {'resolution': 10, 'description': 'NIR'},
    'B8A': {'resolution': 20, 'description': 'Vegetation Red Edge'},
    'B11': {'resolution': 20, 'description': 'SWIR'},
    'B12': {'resolution': 20, 'description': 'SWIR'},
}

# Default bands for export (all bands)
DEFAULT_BANDS = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12']


class GEEService:
    """Service for Google Earth Engine operations."""

    _instance: Optional['GEEService'] = None
    _initialized: bool = False

    def __new__(cls):
        """Singleton pattern to reuse GEE initialization."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize GEE with service account credentials."""
        if not GEEService._initialized:
            self._initialize_ee()
            GEEService._initialized = True

    def _initialize_ee(self) -> None:
        """Initialize Earth Engine with service account."""
        if not os.path.exists(GEE_SERVICE_ACCOUNT_PATH):
            raise FileNotFoundError(
                f"GEE service account key not found at: {GEE_SERVICE_ACCOUNT_PATH}. "
                "Please set GEE_SERVICE_ACCOUNT_PATH environment variable or place "
                "your service account JSON file in backend/credentials/"
            )

        with open(GEE_SERVICE_ACCOUNT_PATH) as f:
            service_account_info = json.load(f)

        credentials = ee.ServiceAccountCredentials(
            email=service_account_info.get('client_email'),
            key_file=GEE_SERVICE_ACCOUNT_PATH
        )
        ee.Initialize(credentials)

    def _mask_clouds_qa60(self, image: ee.Image) -> ee.Image:
        """Apply cloud masking using QA60 bitmask."""
        qa = image.select('QA60')
        # Bits 10 and 11 are clouds and cirrus
        cloud_bit_mask = 1 << 10
        cirrus_bit_mask = 1 << 11
        mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
            qa.bitwiseAnd(cirrus_bit_mask).eq(0)
        )
        return image.updateMask(mask)

    def get_sentinel2_composite(
        self,
        geometry: Dict,
        start_date: str,
        end_date: str,
        bands: List[str],
        cloud_cover_max: int = 20
    ) -> ee.Image:
        """
        Get cloud-masked Sentinel-2 L2A median composite.

        Args:
            geometry: GeoJSON geometry for the chip
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            bands: List of band names to include
            cloud_cover_max: Maximum cloud cover percentage filter

        Returns:
            ee.Image: Median composite image
        """
        # Convert GeoJSON to EE geometry
        ee_geometry = ee.Geometry(geometry)

        # Get Sentinel-2 L2A collection (harmonized for consistent processing)
        collection = (
            ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(ee_geometry)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_cover_max))
            .map(self._mask_clouds_qa60)
        )

        # Create median composite and select requested bands
        composite = collection.median().select(bands)

        # Clip to geometry
        return composite.clip(ee_geometry)

    def download_chip(
        self,
        chip_id: str,
        project_id: int,
        geometry: Dict,
        start_date: str,
        end_date: str,
        bands: Optional[List[str]] = None,
        cloud_cover_max: int = 20,
        scale: int = 10
    ) -> str:
        """
        Download chip imagery directly to local file.

        Args:
            chip_id: Unique chip identifier
            project_id: Project ID for organizing exports
            geometry: GeoJSON Polygon geometry
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            bands: List of band names (defaults to all bands)
            cloud_cover_max: Max cloud cover percentage
            scale: Output resolution in meters

        Returns:
            str: Local file path where GeoTIFF was saved
        """
        if bands is None:
            bands = DEFAULT_BANDS

        # Get composite image
        image = self.get_sentinel2_composite(
            geometry, start_date, end_date, bands, cloud_cover_max
        )

        # Convert geometry to EE geometry for download region
        ee_geometry = ee.Geometry(geometry)

        # Get download URL
        url = image.getDownloadURL({
            'name': chip_id,
            'bands': bands,
            'region': ee_geometry,
            'scale': scale,
            'format': 'GEO_TIFF',
            'crs': 'EPSG:4326'
        })

        # Create export directory
        export_dir = Path(EXPORTS_DIR) / str(project_id)
        export_dir.mkdir(parents=True, exist_ok=True)

        # Download file
        local_path = export_dir / f'{chip_id}.tif'
        response = requests.get(url, stream=True, timeout=300)
        response.raise_for_status()

        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return str(local_path)

    def get_image_info(
        self,
        geometry: Dict,
        start_date: str,
        end_date: str,
        cloud_cover_max: int = 20
    ) -> Dict:
        """
        Get information about available imagery for a region.

        Args:
            geometry: GeoJSON geometry
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            cloud_cover_max: Max cloud cover percentage

        Returns:
            Dict with image count and date range info
        """
        ee_geometry = ee.Geometry(geometry)

        collection = (
            ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(ee_geometry)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_cover_max))
        )

        count = collection.size().getInfo()

        return {
            'imageCount': count,
            'startDate': start_date,
            'endDate': end_date,
            'cloudCoverMax': cloud_cover_max
        }


# Module-level function for getting the singleton instance
def get_gee_service() -> GEEService:
    """Get the GEE service singleton instance."""
    return GEEService()
