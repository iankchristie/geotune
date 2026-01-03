# GeoLabel - Satellite Imagery Labeling Application

## Overview
Full-stack web application for interactive satellite imagery labeling, semantic segmentation model training, and iterative human-in-the-loop verification.

## Incremental Implementation Plan

This plan is organized into phases with verification checkpoints. Each phase must be verified before proceeding to the next.

---

## PHASE 1: Frontend - Map and Labeling Interface
**Status: COMPLETE**

### Objective
Create a React frontend with Mapbox satellite imagery where users can:
- Draw polygons around features of interest (positive samples)
- Click to place negative sample chips (256x256 pixel tiles)
- See visual feedback for placed labels
- Delete labels

### Implementation Steps

#### 1.1 Project Setup
- [x] Create CLAUDE.md with project conventions
- [x] Create PLAN.md
- [x] Create frontend directory structure
- [x] Initialize package.json with dependencies
- [x] Configure ESLint and Prettier

#### 1.2 Basic Map Display
- [x] Create MapContainer component with Mapbox GL JS
- [x] Configure satellite-v9 style
- [x] Add placeholder for Mapbox access token
- [x] Verify: Map displays satellite imagery

#### 1.3 Polygon Drawing (Positive Samples)
- [x] Integrate mapbox-gl-draw for polygon drawing
- [x] Implement "Draw Polygon" mode
- [x] On polygon complete: calculate overlapping 256x256 chips
- [x] Store polygon + generated chips in state
- [x] Verify: Can draw polygon and see generated chips

#### 1.4 Click-to-Place (Negative Samples)
- [x] Implement "Place Negative" mode
- [x] On map click: create 256x256 chip centered on click
- [x] Show red semi-transparent overlay for chip boundary
- [x] Store chip in state
- [x] Verify: Can click to place negative chips

#### 1.5 Visual Feedback and Labels Display
- [x] Display existing chips on map:
  - Green outline/fill for positive chips
  - Red outline/fill for negative chips
- [x] Add click-to-delete functionality on chips
- [x] Verify: Labels persist visually, can delete

#### 1.6 Sidebar UI
- [x] Create Sidebar component
- [x] Mode selector: "Draw Positive" / "Place Negative" / "Select"
- [x] Label count display
- [x] Clear all button
- [x] Save button (placeholder for Phase 2)
- [x] Verify: Mode switching works correctly

### Coordinate Convention
**CRITICAL: All coordinates use [longitude, latitude] order**
- GeoJSON standard: [lng, lat]
- Mapbox GL JS: [lng, lat]
- Turf.js: [lng, lat]

### Verification Checklist for Phase 1
- [x] Map displays with satellite imagery
- [x] Can draw polygons (positive samples)
- [x] Polygons generate correct chip overlays (green)
- [x] Can click to place negative chips (red)
- [x] Chips display correctly on map
- [x] Can delete individual chips/polygons (with confirmation modal)
- [x] Mode switching works in sidebar
- [x] No coordinate order bugs

---

## PHASE 2: Backend API - Data Persistence
**Status: COMPLETE**

### Objective
Flask backend with SQLite to persist projects and labels. Auto-load labels on app startup.

### Implementation

#### Backend Structure
```
backend/
├── app/
│   ├── __init__.py          # Flask app factory
│   ├── config.py            # Configuration
│   ├── database.py          # SQLite connection and schema
│   └── routes/
│       ├── __init__.py      # Blueprint registration
│       ├── projects.py      # Project CRUD
│       └── labels.py        # Labels API
├── requirements.txt         # Flask, flask-cors, pytest
├── run.py                   # Dev server entry point
└── venv/                    # Virtual environment
```

#### Database Schema
```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE chips (
    id TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL,
    geometry_geojson TEXT NOT NULL,
    center_lng REAL NOT NULL,
    center_lat REAL NOT NULL,
    chip_type TEXT NOT NULL CHECK (chip_type IN ('positive', 'negative')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE polygons (
    id TEXT PRIMARY KEY,
    chip_id TEXT NOT NULL,
    geometry_geojson TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chip_id) REFERENCES chips(id) ON DELETE CASCADE
);
```

#### API Endpoints
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/<id>` - Get project
- `DELETE /api/projects/<id>` - Delete project
- `GET /api/projects/<id>/labels` - Get chips and polygons
- `POST /api/projects/<id>/labels` - Save chips and polygons
- `DELETE /api/projects/<id>/labels` - Clear labels
- `GET /api/health` - Health check

#### Frontend Changes
- Added `frontend/src/services/api.js` - API client
- Updated `useLabels.js` - Added setInitialState function
- Updated `App.jsx` - Project state, auto-load, save handler
- Updated `Sidebar.jsx` - Save button with feedback
- Updated `vite.config.js` - API proxy

### Automated Verification (API Tests)
- [x] Backend starts on port 5001
- [x] Health endpoint returns healthy status
- [x] Can create/list/delete projects via API
- [x] Can save/load/clear labels via API

### Manual Verification Checklist
To verify the full integration, run both servers and test in the browser:

**Setup:**
```bash
# Terminal 1 - Backend
cd backend && source venv/bin/activate && python run.py

# Terminal 2 - Frontend
cd frontend && npm start
```

**Test Steps:**
- [x] App loads without errors (check browser console)
- [x] Default project is auto-created on first load
- [x] Can place negative chips (red) on the map
- [x] Can draw positive chips with polygons (green)
- [x] Save button shows "Saving..." during save
- [x] Save button shows "Labels saved successfully!" after save
- [x] Refresh page - labels persist and reload correctly
- [x] Clear All removes all labels from map
- [x] Clear All persists after refresh (labels stay cleared)

---

## PHASE 2.5: Home Page - Project Management
**Status: COMPLETE**

### Objective
Add a home page as the landing page that displays all projects and allows users to create new ones before navigating to the map labeling interface.

### Implementation

#### New Components
```
frontend/src/components/
├── Home/
│   ├── HomePage.jsx       # Main container with project list
│   ├── HomePage.css       # Styling
│   ├── ProjectCard.jsx    # Individual project display card
│   ├── ProjectCard.css
│   ├── NewProjectModal.jsx # Modal for creating new project
│   └── NewProjectModal.css
└── LabelingPage/
    ├── LabelingPage.jsx   # Extracted labeling interface
    └── LabelingPage.css
```

#### Changes Made
- Added `react-router-dom` for client-side routing
- Created routes: `/` (home) and `/project/:projectId` (labeling)
- Refactored `App.jsx` to be routing container
- Added back navigation button to Sidebar

### Manual Verification Checklist

**Setup:**
```bash
# Terminal 1 - Backend
cd backend && source venv/bin/activate && python run.py

# Terminal 2 - Frontend
cd frontend && npm start
```

**Test Steps:**
- [x] Home page loads as landing page (shows project list or empty state)
- [x] Can create new project via "New Project" button
- [x] Project creation navigates to labeling interface
- [x] Projects list displays correctly with name and date
- [x] Can click project card to open labeling interface
- [x] Can delete project with confirmation modal
- [x] Back button in labeling page navigates to home
- [x] URL updates correctly when navigating (`/`, `/project/1`)
- [x] Direct URL access works (e.g., navigating directly to `/project/1`)

---

## PHASE 2.6: MapBlade - Selection Details Panel
**Status: COMPLETE**

### Objective
Add a reusable right-side blade component that shows details when selecting items on the map. Initially shows chip details in SELECT mode.

### Implementation

#### New Components
```
frontend/src/components/MapBlade/
├── MapBlade.jsx      # Generic blade container (reusable)
├── MapBlade.css      # Blade styling with slide animation
├── ChipDetails.jsx   # Chip-specific content
└── ChipDetails.css   # Chip details styling
```

#### Changes Made
- MapBlade: Generic container with `isOpen`, `onClose`, `title`, `children` props
- ChipDetails: Shows chip type, coordinates, date, polygon count, delete button
- SELECT mode now selects chips instead of immediately deleting
- Selected chip has blue highlight on map
- Clicking empty map area closes blade

### Manual Verification Checklist

**Setup:**
```bash
# Terminal 1 - Backend
cd backend && source venv/bin/activate && python run.py

# Terminal 2 - Frontend
cd frontend && npm start
```

**Test Steps:**
- [x] In SELECT mode, clicking chip opens MapBlade on right
- [x] MapBlade shows chip type (positive/negative) with color
- [x] MapBlade shows center coordinates
- [x] MapBlade shows created date
- [x] MapBlade shows polygon count for positive chips
- [x] Delete button in blade removes chip and closes blade
- [x] Close button (X) closes blade
- [x] Clicking another chip switches blade content
- [x] Clicking empty map area closes blade
- [x] Selected chip has blue highlight on map
- [x] Switching modes closes blade

---

## PHASE 3: GEE Integration - Imagery Export
**Status: COMPLETE**

### Objective
Export Sentinel-2 L2A imagery from Google Earth Engine for labeled chips. Uses service account authentication with direct local download.

### Implementation

#### Backend Files Created
```
backend/app/
├── services/
│   ├── __init__.py
│   ├── gee_service.py       # GEE interaction (auth, composite, download)
│   ├── imagery_service.py   # Thumbnail and metadata from GeoTIFFs
│   └── mask_service.py      # Binary mask generation for positive chips
├── workers/
│   ├── __init__.py
│   └── export_worker.py     # Background download worker
├── routes/
│   ├── imagery.py           # Imagery status endpoints
│   └── chips.py             # Chip thumbnail, metadata, and mask endpoints
└── config.py                # EXPORTS_DIR, MASKS_DIR configuration
```

#### API Endpoints
- `GET /api/projects/{id}/imagery` - Get download status for all chips
- `GET /api/chips/{id}/thumbnail` - Get RGB PNG thumbnail
- `GET /api/chips/{id}/metadata` - Get GeoTIFF metadata (bounds, dimensions, resolution)
- `GET /api/chips/{id}/mask` - Get binary mask PNG for positive chips
- `HEAD /api/chips/{id}/mask` - Check if mask exists

#### Frontend Components
- `ExportDetails.jsx` - Shows exported imagery gallery with download status
- `ChipDetails.jsx` - Enhanced with metadata from GeoTIFF and mask overlay toggle
- "Exported Imagery" button in Sidebar opens gallery view
- Back navigation from chip details to gallery

#### Key Features
- Background worker thread downloads chips automatically on save
- Fixed parameters: 2025-01-01 to 2025-12-31, 30% cloud cover max
- All 10 Sentinel-2 bands: B2, B3, B4, B5, B6, B7, B8, B8A, B11, B12
- Cloud masking with QA60 bitmask
- Median composite for cloud-free imagery
- RGB thumbnails generated on-the-fly from GeoTIFFs
- Binary masks auto-generated for positive chips (GeoTIFF format for ML training)
- Mask overlay toggle in chip details view

### Output Structure
```
backend/data/
├── exports/{project_id}/{chip_id}.tif    # 10-band Sentinel-2 imagery
└── masks/{project_id}/{chip_id}.tif      # Single-band binary mask (0/1)
```

### Configuration Required
```bash
# Environment variables
GEE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
EXPORTS_DIR=/path/to/exports  # defaults to backend/data/exports
MASKS_DIR=/path/to/masks      # defaults to backend/data/masks
```

### Manual Verification Checklist

**Setup:**
```bash
# Install new dependencies
cd backend && pip install -r requirements.txt

# Terminal 1 - Backend
cd backend && source venv/bin/activate && python run.py

# Terminal 2 - Frontend
cd frontend && npm start
```

**Test Steps:**
- [x] Backend starts with GEE credentials configured
- [x] Saving labels triggers background download of chip imagery
- [x] GeoTIFFs download to `backend/data/exports/{project_id}/`
- [x] "Exported Imagery" button shows gallery of downloaded chips
- [x] Clicking chip in gallery opens chip details with back navigation
- [x] Chip details shows metadata from GeoTIFF (bounds, dimensions, resolution)
- [x] Positive chips have binary masks generated automatically
- [x] Mask overlay toggle shows mask on RGB preview
- [x] Exported files persist for ML training use

---

## PHASE 4: Training Pipeline
**Status: NOT STARTED**

### Objective
Train a semantic segmentation model on labeled chips using TorchGeo's SemanticSegmentationTask with pretrained weights. Support background training with progress tracking.

### Implementation

#### Backend Files to Create
```
backend/app/
├── ml/
│   ├── __init__.py
│   ├── dataset.py           # Custom RasterDataset for GeoLabel chips
│   ├── datamodule.py        # PyTorch Lightning DataModule
│   └── trainer.py           # Training orchestration with fixed config
├── workers/
│   └── training_worker.py   # Background training job processor
└── routes/
    └── training.py          # Training API endpoints
```

#### Dependencies (add to requirements.txt)
```
torch>=2.0.0
torchvision>=0.15.0
torchgeo>=0.8.0
lightning>=2.0.0
segmentation-models-pytorch>=0.3.0
albumentations>=1.3.0
tensorboard>=2.14.0
```

#### Custom Dataset Class
```python
# backend/app/ml/dataset.py
from torchgeo.datasets import RasterDataset

class GeoLabelDataset(RasterDataset):
    """Custom dataset for GeoLabel exported chips and masks."""

    filename_glob = "*.tif"
    is_image = True

    def __init__(self, paths, crs=None, res=None, transforms=None):
        super().__init__(paths, crs=crs, res=res, transforms=transforms)

class GeoLabelMaskDataset(RasterDataset):
    """Dataset for binary segmentation masks."""

    filename_glob = "*.tif"
    is_image = False

    def __init__(self, paths, crs=None, res=None, transforms=None):
        super().__init__(paths, crs=crs, res=res, transforms=transforms)
```

#### DataModule Configuration
```python
# backend/app/ml/datamodule.py
from lightning import LightningDataModule
from torchgeo.datasets import stack_samples
from torchgeo.samplers import RandomGeoSampler, GridGeoSampler
from torch.utils.data import DataLoader

class GeoLabelDataModule(LightningDataModule):
    def __init__(
        self,
        project_id: int,
        batch_size: int = 8,
        patch_size: int = 256,
        num_workers: int = 4,
        val_split: float = 0.2,
    ):
        super().__init__()
        self.project_id = project_id
        self.batch_size = batch_size
        self.patch_size = patch_size
        self.num_workers = num_workers
        self.val_split = val_split

    def setup(self, stage=None):
        # Load imagery and mask datasets
        # Split into train/val based on chip IDs
        # Create intersection datasets
        pass

    def train_dataloader(self):
        return DataLoader(
            self.train_dataset,
            batch_size=self.batch_size,
            sampler=self.train_sampler,
            num_workers=self.num_workers,
            collate_fn=stack_samples,
        )
```

#### SemanticSegmentationTask Configuration (TorchGeo v0.8.0)
```python
# backend/app/ml/task.py
from torchgeo.trainers import SemanticSegmentationTask

def create_segmentation_task() -> SemanticSegmentationTask:
    """Create SemanticSegmentationTask with fixed configuration.

    Fixed settings:
    - UNet with ResNet50 backbone
    - Pretrained ImageNet weights
    - Binary segmentation task
    - BCE loss
    """
    return SemanticSegmentationTask(
        model="unet",
        backbone="resnet50",
        weights=True,
        in_channels=10,       # Sentinel-2 bands
        task="binary",
        lr=1e-4,
        loss="bce",
    )
```

#### Database Schema Addition
```sql
CREATE TABLE training_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    config_json TEXT NOT NULL,      -- Training hyperparameters
    started_at TEXT,
    completed_at TEXT,
    current_epoch INTEGER DEFAULT 0,
    total_epochs INTEGER NOT NULL,
    train_loss REAL,
    val_loss REAL,
    val_iou REAL,                   -- Intersection over Union
    checkpoint_path TEXT,           -- Path to best model checkpoint
    error_message TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

#### API Endpoints
- `GET /api/projects/{id}/training` - List training jobs for project
- `POST /api/projects/{id}/training` - Start new training job
- `GET /api/projects/{id}/training/{jobId}` - Get job status and metrics
- `DELETE /api/projects/{id}/training/{jobId}` - Cancel training job

#### TensorBoard Logging
TensorBoard logs are saved for backend debugging and analysis:
```bash
# View training logs
tensorboard --logdir backend/data/models/{project_id}/{job_id}/tensorboard/
```

#### Frontend Components
```
frontend/src/components/MapBlade/
└── TrainingDetails.jsx       # Training status and progress display
```

#### UI Flow
1. "Train" button in Sidebar (next to Export) starts training with fixed configuration
2. TrainingDetails blade opens showing:
   - Training status (pending/running/completed/failed)
   - Current epoch / total epochs progress bar
   - Train loss and validation loss
   - Validation IoU metric
   - Training history (past runs with metrics)

#### Fixed Training Configuration
All hyperparameters are fixed (no UI configuration):
- Model: UNet with ResNet50 backbone
- Pretrained: ImageNet weights
- Task: Binary segmentation
- Loss: BCE (binary cross-entropy)
- Learning rate: 1e-4
- Max epochs: 50
- Batch size: 8
- Early stopping: patience=10 on val_loss

#### Key Features
- TorchGeo v0.8.0 SemanticSegmentationTask with pretrained ImageNet weights
- Binary segmentation mode (single target class) optimized for GeoLabel use case
- Fixed UNet + ResNet50 architecture (no configuration needed)
- Background training with PyTorch Lightning Trainer
- Real-time progress updates in blade (epoch, loss, IoU metrics)
- Automatic train/val split from labeled chips
- TensorBoard logging for detailed backend debugging
- Model checkpointing (saves best model by val_iou)
- Early stopping to prevent overfitting

#### Output Structure
```
backend/data/
├── exports/{project_id}/{chip_id}.tif    # Input imagery
├── masks/{project_id}/{chip_id}.tif      # Target masks
└── models/{project_id}/
    ├── {job_id}/
    │   ├── checkpoints/
    │   │   └── best.ckpt                 # Best model checkpoint
    │   ├── tensorboard/                  # Training logs
    │   └── config.json                   # Training configuration
    └── latest.ckpt                       # Symlink to most recent best model
```

### Manual Verification Checklist

**Setup:**
```bash
# Install new dependencies
cd backend && pip install -r requirements.txt

# Terminal 1 - Backend
cd backend && source venv/bin/activate && python run.py

# Terminal 2 - Frontend
cd frontend && npm start
```

**Test Steps:**
- [ ] "Train" button in sidebar starts training job
- [ ] TrainingDetails blade opens showing status
- [ ] Progress updates display in real-time (epoch, loss, metrics)
- [ ] Can cancel in-progress training
- [ ] Training completes and saves checkpoint
- [ ] Training history shows past runs with metrics
- [ ] Completed model ready for inference (Phase 5)

---

## PHASE 5: Inference Pipeline (FUTURE)
**Status: NOT STARTED**

### Objective
Run inference across project region and display results.

### Key Components
- Subregion grid generation
- Sliding window inference
- Probability map overlay

---

## PHASE 6: Verification Interface (FUTURE)
**Status: NOT STARTED**

### Objective
Human-in-the-loop verification of model predictions.

### Key Components
- Tile selection (high/low/uncertain confidence)
- Verification modal
- Feedback loop to training set

---

## Configuration Decisions

- **Mapbox Token**: Placeholder configuration (user provides later)
- **Background Jobs**: Python threading (when backend is added)
- **Repository Structure**: Monorepo with frontend/ and backend/ directories
- **Coordinate Order**: [longitude, latitude] everywhere (GeoJSON standard)

---

## Architecture Reference (Full Application)

### Final Project Structure
```
GeoLabel/
├── CLAUDE.md
├── PLAN.md
├── pyproject.toml
├── .pre-commit-config.yaml
├── frontend/
│   ├── package.json
│   ├── .eslintrc.js
│   ├── .prettierrc
│   └── src/
│       ├── components/
│       │   ├── Map/
│       │   ├── Sidebar/
│       │   └── Verification/
│       ├── hooks/
│       ├── services/
│       └── context/
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── ml/
│   │   └── utils/
│   ├── tests/
│   └── requirements.txt
└── data/
    └── projects/
```

### API Endpoints (Future Reference)
- `GET/POST /api/projects` - Project management
- `GET/POST/DELETE /api/projects/<id>/labels` - Labels
- `GET/POST/DELETE /api/projects/<id>/chips` - Chips
- `POST /api/projects/<id>/training/start` - Training
- `POST /api/projects/<id>/inference/start` - Inference
- `GET/POST /api/projects/<id>/verification/tiles` - Verification
