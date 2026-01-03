"""Training orchestration for GeoLabel semantic segmentation."""

import os
from typing import Callable

from lightning import Trainer
from lightning.pytorch.callbacks import EarlyStopping, ModelCheckpoint
from lightning.pytorch.loggers import TensorBoardLogger
from torchgeo.trainers import SemanticSegmentationTask

from app.config import MODELS_DIR
from app.ml.datamodule import GeoLabelDataModule


# Fixed training configuration
TRAINING_CONFIG = {
    "model": "unet",
    "backbone": "resnet50",
    "weights": True,
    "in_channels": 10,  # Sentinel-2 bands
    "task": "binary",
    "lr": 1e-4,
    "loss": "bce",
    "max_epochs": 50,
    "batch_size": 8,
    "early_stopping_patience": 10,
}


def create_segmentation_task() -> SemanticSegmentationTask:
    """Create SemanticSegmentationTask with fixed configuration."""
    return SemanticSegmentationTask(
        model=TRAINING_CONFIG["model"],
        backbone=TRAINING_CONFIG["backbone"],
        weights=TRAINING_CONFIG["weights"],
        in_channels=TRAINING_CONFIG["in_channels"],
        task=TRAINING_CONFIG["task"],
        lr=TRAINING_CONFIG["lr"],
        loss=TRAINING_CONFIG["loss"],
    )


def run_training(
    project_id: int,
    job_id: int,
    progress_callback: Callable[[int, int, float, float, float], None] | None = None,
) -> str:
    """Run training for a project.

    Args:
        project_id: Project ID to train on
        job_id: Training job ID for logging
        progress_callback: Callback function(epoch, total_epochs, train_loss, val_loss, val_iou)
            Called after each epoch to report progress

    Returns:
        Path to best model checkpoint

    Raises:
        ValueError: If no training data available
        Exception: If training fails
    """
    # Create output directory for this job
    job_dir = os.path.join(MODELS_DIR, str(project_id), str(job_id))
    os.makedirs(job_dir, exist_ok=True)

    checkpoint_dir = os.path.join(job_dir, "checkpoints")
    tensorboard_dir = os.path.join(job_dir, "tensorboard")

    # Create data module
    datamodule = GeoLabelDataModule(
        project_id=project_id,
        batch_size=TRAINING_CONFIG["batch_size"],
        patch_size=256,
        num_workers=0,  # Use 0 for SQLite compatibility
        val_split=0.2,
    )

    # Create task (model)
    task = create_segmentation_task()

    # Create callbacks
    checkpoint_callback = ModelCheckpoint(
        dirpath=checkpoint_dir,
        filename="best",
        monitor="val_loss",
        mode="min",
        save_top_k=1,
    )

    early_stopping = EarlyStopping(
        monitor="val_loss",
        patience=TRAINING_CONFIG["early_stopping_patience"],
        mode="min",
    )

    # Create logger
    logger = TensorBoardLogger(
        save_dir=tensorboard_dir,
        name="",
        version="",
    )

    # Create custom callback for progress reporting
    callbacks = [checkpoint_callback, early_stopping]

    if progress_callback:
        from lightning.pytorch.callbacks import Callback

        class ProgressCallback(Callback):
            def on_train_epoch_end(self, trainer, pl_module):
                epoch = trainer.current_epoch + 1
                total_epochs = TRAINING_CONFIG["max_epochs"]

                # Get metrics
                train_loss = trainer.callback_metrics.get("train_loss", 0.0)
                val_loss = trainer.callback_metrics.get("val_loss", 0.0)
                val_iou = trainer.callback_metrics.get("val_JaccardIndex", 0.0)

                # Convert to Python floats
                train_loss = float(train_loss) if train_loss else 0.0
                val_loss = float(val_loss) if val_loss else 0.0
                val_iou = float(val_iou) if val_iou else 0.0

                progress_callback(epoch, total_epochs, train_loss, val_loss, val_iou)

        callbacks.append(ProgressCallback())

    # Create trainer
    trainer = Trainer(
        max_epochs=TRAINING_CONFIG["max_epochs"],
        accelerator="auto",
        devices=1,
        callbacks=callbacks,
        logger=logger,
        enable_progress_bar=False,  # Disable for background training
        log_every_n_steps=1,
    )

    # Run training
    trainer.fit(task, datamodule=datamodule)

    # Return path to best checkpoint
    best_checkpoint = checkpoint_callback.best_model_path
    return best_checkpoint
