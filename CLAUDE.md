# GeoLabel - Project Context

## Overview
GeoLabel is a full-stack web application for interactive satellite imagery labeling, semantic segmentation model training, and iterative human-in-the-loop verification.

## Tech Stack
- **Frontend**: React, Mapbox GL JS
- **Backend**: Flask, SQLite (future)
- **ML**: PyTorch, TorchGeo (future)
- **Imagery**: Google Earth Engine, Sentinel-2 L2A (future)

## Critical Conventions

### Coordinate Order
**CRITICAL: All coordinates use [longitude, latitude] order throughout the application.**

This is the GeoJSON standard and matches:
- Mapbox GL JS: `[lng, lat]`
- Turf.js: `[lng, lat]`
- GeoJSON specification: `[lng, lat]`
- Google Earth Engine: `[lng, lat]`

Common pitfalls:
- Leaflet uses `[lat, lng]` - we do NOT use Leaflet
- Google Maps uses `{lat, lng}` object - we do NOT use this format
- Always double-check when copying coordinates from other sources

Example:
```javascript
// CORRECT
const newYork = [-74.006, 40.7128];  // [lng, lat]

// WRONG - do not use
const newYork = [40.7128, -74.006];  // lat, lng - WRONG ORDER
```

### Chip Specifications
- **Size**: 256 x 256 pixels
- **Resolution**: 10 meters per pixel (Sentinel-2)
- **Ground coverage**: 2.56 km x 2.56 km per chip
- **Size in meters**: 2560m x 2560m

### File Naming
- React components: PascalCase (e.g., `MapContainer.jsx`)
- Utility files: camelCase (e.g., `chipUtils.js`)
- CSS files: Match component name (e.g., `MapContainer.css`)
- Python files: snake_case (e.g., `gee_service.py`)

### Code Style
- **JavaScript/React**: ESLint + Prettier
- **Python**: Ruff + mypy (when backend is added)
- No emojis in code or comments
- Type hints required in Python

## Project Structure
```
GeoLabel/
├── CLAUDE.md          # This file
├── PLAN.md            # Implementation plan with phases
├── frontend/          # React application
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── ...
│   └── package.json
├── backend/           # Flask application (future)
└── data/              # Project data directory (future)
```

## Current Phase
**Phase 1: Frontend Map and Labeling Interface**

See PLAN.md for detailed implementation steps.

## Environment Setup

### Frontend
```bash
cd frontend
npm install
npm start
```

### Mapbox Token
Set your Mapbox access token in `frontend/src/config.js`:
```javascript
export const MAPBOX_TOKEN = 'your-token-here';
```

## Common Commands

### Development
```bash
# Start frontend dev server
cd frontend && npm start

# Run frontend linting
cd frontend && npm run lint

# Format frontend code
cd frontend && npm run format
```

## Gotchas and Tips

1. **Mapbox Draw events**: Use `draw.create`, `draw.delete`, `draw.update` events
2. **GeoJSON winding order**: Exterior rings are counterclockwise, holes are clockwise
3. **Chip overlap calculation**: Use Turf.js `booleanIntersects` for polygon-chip intersection
4. **React state with maps**: Be careful with map instance refs vs state
5. **Coordinate precision**: Store coordinates with sufficient precision (6+ decimal places)
