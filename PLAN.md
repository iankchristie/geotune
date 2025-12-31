# GeoLabel - Satellite Imagery Labeling Application

## Overview
Full-stack web application for interactive satellite imagery labeling, semantic segmentation model training, and iterative human-in-the-loop verification.

## Incremental Implementation Plan

This plan is organized into phases with verification checkpoints. Each phase must be verified before proceeding to the next.

---

## PHASE 1: Frontend - Map and Labeling Interface (CURRENT)
**Status: COMPLETE - AWAITING VERIFICATION**

### Objective
Create a React frontend with Mapbox satellite imagery where users can:
- Draw polygons around features of interest (positive samples)
- Click to place negative sample chips (256x256 pixel tiles)
- See visual feedback for placed labels
- Delete labels

### Files to Create

```
GeoLabel/
├── CLAUDE.md                    # Project context and conventions
├── PLAN.md                      # This file (copy from plan)
├── frontend/
│   ├── package.json
│   ├── .eslintrc.js
│   ├── .prettierrc
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.jsx
│       ├── index.css
│       ├── App.jsx
│       ├── App.css
│       ├── config.js
│       ├── components/
│       │   ├── Map/
│       │   │   ├── MapContainer.jsx      # Main map component
│       │   │   ├── MapContainer.css
│       │   │   └── chipUtils.js          # Chip boundary calculations
│       │   └── Sidebar/
│       │       ├── Sidebar.jsx           # Mode selection, label list
│       │       └── Sidebar.css
│       └── hooks/
│           └── useLabels.js              # Label state management
```

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
- [ ] Verify: Map displays satellite imagery

#### 1.3 Polygon Drawing (Positive Samples)
- [x] Integrate mapbox-gl-draw for polygon drawing
- [x] Implement "Draw Polygon" mode
- [x] On polygon complete: calculate overlapping 256x256 chips
- [x] Store polygon + generated chips in state
- [ ] Verify: Can draw polygon and see generated chips

#### 1.4 Click-to-Place (Negative Samples)
- [x] Implement "Place Negative" mode
- [x] On map click: create 256x256 chip centered on click
- [x] Show red semi-transparent overlay for chip boundary
- [x] Store chip in state
- [ ] Verify: Can click to place negative chips

#### 1.5 Visual Feedback and Labels Display
- [x] Display existing chips on map:
  - Green outline/fill for positive chips
  - Red outline/fill for negative chips
- [x] Add click-to-delete functionality on chips
- [ ] Verify: Labels persist visually, can delete

#### 1.6 Sidebar UI
- [x] Create Sidebar component
- [x] Mode selector: "Draw Positive" / "Place Negative" / "Select"
- [x] Label count display
- [x] Clear all button
- [ ] Verify: Mode switching works correctly

### Coordinate Convention
**CRITICAL: All coordinates use [longitude, latitude] order**
- GeoJSON standard: [lng, lat]
- Mapbox GL JS: [lng, lat]
- Turf.js: [lng, lat]

### Verification Checklist for Phase 1
- [ ] Map displays with satellite imagery
- [ ] Can draw polygons (positive samples)
- [ ] Polygons generate correct chip overlays (green)
- [ ] Can click to place negative chips (red)
- [ ] Chips display correctly on map
- [ ] Can delete individual chips/polygons
- [ ] Mode switching works in sidebar
- [ ] No coordinate order bugs

---

## PHASE 2: Backend API - Data Persistence (FUTURE)
**Status: NOT STARTED**

### Objective
Flask backend with SQLite to persist projects and labels.

### Key Components
- Flask app with blueprints
- SQLite database with spatial data (GeoJSON as text)
- Project CRUD endpoints
- Label/Chip CRUD endpoints

### Database Schema Preview
```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    bbox_geojson TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE labels (
    id INTEGER PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    geometry_geojson TEXT NOT NULL,
    label_type TEXT NOT NULL  -- 'positive' or 'negative'
);

CREATE TABLE chips (
    id INTEGER PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    label_id INTEGER REFERENCES labels(id),
    bbox_geojson TEXT NOT NULL,
    center_lng REAL NOT NULL,
    center_lat REAL NOT NULL,
    chip_type TEXT NOT NULL
);
```

---

## PHASE 3: GEE Integration - Imagery Export (FUTURE)
**Status: NOT STARTED**

### Objective
Export Sentinel-2 imagery chips from Google Earth Engine.

### Key Components
- GEE service for Sentinel-2 L2A access
- Cloud masking with QA60 bitmask
- Median composite over date range
- GeoTIFF export for chips

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
