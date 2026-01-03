"""PyTorch Lightning DataModule for GeoLabel training."""

import os
import random
from typing import Any

import torch
from lightning import LightningDataModule
from torch.utils.data import DataLoader
from torchgeo.datasets import stack_samples
from torchgeo.samplers import RandomGeoSampler, GridGeoSampler

from app.config import EXPORTS_DIR, MASKS_DIR
from app.ml.dataset import GeoLabelImageDataset, GeoLabelMaskDataset, get_chip_ids_with_masks


class GeoLabelDataModule(LightningDataModule):
    """DataModule for training on GeoLabel exported chips and masks."""

    def __init__(
        self,
        project_id: int,
        batch_size: int = 8,
        patch_size: int = 256,
        num_workers: int = 0,
        val_split: float = 0.2,
    ) -> None:
        """Initialize the DataModule.

        Args:
            project_id: Project ID to load data for
            batch_size: Batch size for training
            patch_size: Size of patches to sample (should match chip size)
            num_workers: Number of workers for data loading
            val_split: Fraction of data to use for validation
        """
        super().__init__()
        self.project_id = project_id
        self.batch_size = batch_size
        self.patch_size = patch_size
        self.num_workers = num_workers
        self.val_split = val_split

        self.train_dataset = None
        self.val_dataset = None
        self.train_sampler = None
        self.val_sampler = None

    def setup(self, stage: str | None = None) -> None:
        """Set up train and validation datasets.

        Args:
            stage: Stage ('fit', 'validate', 'test', 'predict')
        """
        # Get chips that have both imagery and masks
        chip_ids = get_chip_ids_with_masks(
            self.project_id,
            EXPORTS_DIR,
            MASKS_DIR
        )

        if len(chip_ids) == 0:
            raise ValueError(
                f"No chips with masks found for project {self.project_id}. "
                "Make sure to export imagery and save labels first."
            )

        # Shuffle and split
        random.shuffle(chip_ids)
        split_idx = int(len(chip_ids) * (1 - self.val_split))

        if split_idx == 0:
            split_idx = 1  # Ensure at least one training sample

        train_chip_ids = chip_ids[:split_idx]
        val_chip_ids = chip_ids[split_idx:] if split_idx < len(chip_ids) else chip_ids[:1]

        # Create paths for train and val
        export_path = os.path.join(EXPORTS_DIR, str(self.project_id))
        mask_path = os.path.join(MASKS_DIR, str(self.project_id))

        # For TorchGeo, we need to create intersection datasets
        # Since our chips are individual files, we'll load them all and let
        # the sampler handle the spatial queries

        # Create image and mask datasets
        train_image_ds = GeoLabelImageDataset(export_path)
        train_mask_ds = GeoLabelMaskDataset(mask_path)

        val_image_ds = GeoLabelImageDataset(export_path)
        val_mask_ds = GeoLabelMaskDataset(mask_path)

        # Create intersection datasets
        self.train_dataset = train_image_ds & train_mask_ds
        self.val_dataset = val_image_ds & val_mask_ds

        # Create samplers
        # Use RandomGeoSampler for training, GridGeoSampler for validation
        self.train_sampler = RandomGeoSampler(
            self.train_dataset,
            size=self.patch_size,
            length=len(train_chip_ids) * 4,  # Sample multiple patches per chip
        )

        self.val_sampler = GridGeoSampler(
            self.val_dataset,
            size=self.patch_size,
            stride=self.patch_size,  # Non-overlapping for validation
        )

    def train_dataloader(self) -> DataLoader:
        """Create training DataLoader."""
        return DataLoader(
            self.train_dataset,
            batch_size=self.batch_size,
            sampler=self.train_sampler,
            num_workers=self.num_workers,
            collate_fn=stack_samples,
        )

    def val_dataloader(self) -> DataLoader:
        """Create validation DataLoader."""
        return DataLoader(
            self.val_dataset,
            batch_size=self.batch_size,
            sampler=self.val_sampler,
            num_workers=self.num_workers,
            collate_fn=stack_samples,
        )
