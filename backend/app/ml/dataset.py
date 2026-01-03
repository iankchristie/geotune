"""Custom TorchGeo datasets for GeoLabel imagery and masks."""

import os
from typing import Any

import torch
from torchgeo.datasets import RasterDataset


class GeoLabelImageDataset(RasterDataset):
    """Dataset for GeoLabel exported Sentinel-2 imagery.

    Expects 10-band GeoTIFFs in EXPORTS_DIR/{project_id}/{chip_id}.tif
    """

    filename_glob = "*.tif"
    is_image = True
    separate_files = False

    def __init__(
        self,
        paths: str | list[str],
        crs: Any | None = None,
        res: float | None = None,
        transforms: Any | None = None,
    ) -> None:
        """Initialize the dataset.

        Args:
            paths: Path(s) to directory containing GeoTIFF files
            crs: Coordinate reference system to use
            res: Resolution in units of CRS
            transforms: Transforms to apply to samples
        """
        super().__init__(paths, crs=crs, res=res, transforms=transforms)


class GeoLabelMaskDataset(RasterDataset):
    """Dataset for GeoLabel binary segmentation masks.

    Expects single-band GeoTIFFs in MASKS_DIR/{project_id}/{chip_id}.tif
    Values: 0 = background, 1 = target
    """

    filename_glob = "*.tif"
    is_image = False
    separate_files = False

    def __init__(
        self,
        paths: str | list[str],
        crs: Any | None = None,
        res: float | None = None,
        transforms: Any | None = None,
    ) -> None:
        """Initialize the dataset.

        Args:
            paths: Path(s) to directory containing mask GeoTIFF files
            crs: Coordinate reference system to use
            res: Resolution in units of CRS
            transforms: Transforms to apply to samples
        """
        super().__init__(paths, crs=crs, res=res, transforms=transforms)


def get_chip_ids_with_masks(project_id: int, exports_dir: str, masks_dir: str) -> list[str]:
    """Get list of chip IDs that have both imagery and masks.

    Args:
        project_id: Project ID
        exports_dir: Base exports directory
        masks_dir: Base masks directory

    Returns:
        List of chip IDs that have both imagery and mask files
    """
    export_path = os.path.join(exports_dir, str(project_id))
    mask_path = os.path.join(masks_dir, str(project_id))

    if not os.path.exists(export_path) or not os.path.exists(mask_path):
        return []

    export_chips = {
        os.path.splitext(f)[0]
        for f in os.listdir(export_path)
        if f.endswith('.tif')
    }

    mask_chips = {
        os.path.splitext(f)[0]
        for f in os.listdir(mask_path)
        if f.endswith('.tif')
    }

    # Return chips that have both imagery and masks
    return list(export_chips & mask_chips)
