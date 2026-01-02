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

## PHASE 3: GEE Integration - Imagery Export (CURRENT)
**Status: AWAITING VERIFICATION**

### Objective
Export Sentinel-2 L2A imagery from Google Earth Engine for labeled chips. Uses service account authentication with direct local download.

### Implementation

#### Backend Files Created
```
backend/app/
├── services/
│   ├── __init__.py
│   └── gee_service.py       # GEE interaction (auth, composite, download)
├── workers/
│   ├── __init__.py
│   └── export_worker.py     # Background job processor
└── routes/
    └── exports.py           # Export API endpoints
```

#### Database Schema
- `export_jobs` table - tracks export requests (project_id, status, date range, bands, progress)
- `chip_exports` table - tracks individual chip export status (job_id, chip_id, local_path)

#### API Endpoints
- `GET /api/projects/{id}/exports` - List export jobs
- `POST /api/projects/{id}/exports` - Create export job
- `GET /api/projects/{id}/exports/{jobId}` - Get detailed job status
- `DELETE /api/projects/{id}/exports/{jobId}` - Cancel export job

#### Frontend Components
- `ExportDetails.jsx` - Export status and history in MapBlade
- `ExportForm.jsx` - Date range and cloud cover selection
- "Export Imagery" button in Sidebar

#### Key Features
- Uses `getDownloadURL()` for direct local download (no GCS required)
- Cloud masking with QA60 bitmask (bits 10, 11)
- Median composite over user-specified date range
- All 10 Sentinel-2 bands: B2, B3, B4, B5, B6, B7, B8, B8A, B11, B12
- Background worker thread for async processing
- Real-time progress updates in UI

### Configuration Required
```bash
# Environment variables
GEE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
EXPORTS_DIR=/path/to/exports  # defaults to backend/data/exports
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
- [ ] Backend starts with GEE credentials configured
- [ ] Can create export job via "Export Imagery" button
- [ ] Export job appears in MapBlade export view
- [ ] GeoTIFFs download directly to `backend/data/exports/{project_id}/`
- [ ] Progress updates in real-time in UI
- [ ] Can cancel in-progress export
- [ ] Export history shows completed/failed jobs
- [ ] Exported files persist for ML training use

---

## PHASE 4: Training Pipeline (FUTURE)
**Status: NOT STARTED**

### Objective
Train UNet binary segmentation model on labeled chips.

### Key Components
- UNet architecture (PyTorch)
- Dataset loader for chips and masks
- Background training job
- Progress tracking

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
