import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import PropTypes from 'prop-types';
import { MAPBOX_TOKEN } from '../../config';
import { LABEL_TYPES } from '../../App';
import {
  chipsToFeatureCollection,
  polygonsToFeatureCollection,
  createChipFromCenter,
  snapToChipGrid,
} from './chipUtils';
import './MapContainer.css';

// Set Mapbox access token
mapboxgl.accessToken = MAPBOX_TOKEN;

// Layer IDs
const POSITIVE_CHIPS_LAYER = 'positive-chips-layer';
const POSITIVE_CHIPS_OUTLINE = 'positive-chips-outline';
const NEGATIVE_CHIPS_LAYER = 'negative-chips-layer';
const NEGATIVE_CHIPS_OUTLINE = 'negative-chips-outline';
const PREVIEW_CHIP_LAYER = 'preview-chip-layer';
const ACTIVE_CHIP_LAYER = 'active-chip-layer';
const ACTIVE_CHIP_OUTLINE = 'active-chip-outline';
const PENDING_POLYGONS_LAYER = 'pending-polygons-layer';
const PENDING_POLYGONS_OUTLINE = 'pending-polygons-outline';
const SAVED_POLYGONS_LAYER = 'saved-polygons-layer';
const SAVED_POLYGONS_OUTLINE = 'saved-polygons-outline';
const SELECTED_CHIP_LAYER = 'selected-chip-layer';
const SELECTED_CHIP_OUTLINE = 'selected-chip-outline';
const INFERENCE_BOUNDS_LAYER = 'inference-bounds-layer';
const INFERENCE_BOUNDS_OUTLINE = 'inference-bounds-outline';
const INFERENCE_OVERLAY_LAYER = 'inference-overlay-layer';

// Source IDs
const POSITIVE_CHIPS_SOURCE = 'positive-chips-source';
const NEGATIVE_CHIPS_SOURCE = 'negative-chips-source';
const PREVIEW_CHIP_SOURCE = 'preview-chip-source';
const ACTIVE_CHIP_SOURCE = 'active-chip-source';
const PENDING_POLYGONS_SOURCE = 'pending-polygons-source';
const SAVED_POLYGONS_SOURCE = 'saved-polygons-source';
const SELECTED_CHIP_SOURCE = 'selected-chip-source';
const INFERENCE_BOUNDS_SOURCE = 'inference-bounds-source';
const INFERENCE_OVERLAY_SOURCE = 'inference-overlay-source';

function MapContainer({
  labelType,
  isAnnotating,
  activeChipCenter,
  pendingPolygons,
  polygons,
  chips,
  onStartAnnotation,
  onAddPendingPolygon,
  onNegativeChipPlace,
  onChipSelect,
  selectedChipId,
  isDrawingBounds,
  onBoundsDrawn,
  onCancelBoundsDrawing,
  inferenceOverlay,
  showInferenceOverlay,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Bounding box drawing state
  const [boundsStart, setBoundsStart] = useState(null);
  const [currentBounds, setCurrentBounds] = useState(null);

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [-1.627206, 6.690315], // [lng, lat]
      zoom: 10,
    });

    // Initialize Mapbox Draw
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: 'simple_select',
    });

    map.addControl(draw);
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setMapLoaded(true);

      // Add sources
      map.addSource(POSITIVE_CHIPS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource(NEGATIVE_CHIPS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource(PREVIEW_CHIP_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource(ACTIVE_CHIP_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource(PENDING_POLYGONS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource(SAVED_POLYGONS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource(SELECTED_CHIP_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource(INFERENCE_BOUNDS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource(INFERENCE_OVERLAY_SOURCE, {
        type: 'image',
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
      });

      // Preview chip outline (dashed, color changes based on label type)
      map.addLayer({
        id: PREVIEW_CHIP_LAYER,
        type: 'line',
        source: PREVIEW_CHIP_SOURCE,
        paint: {
          'line-color': '#dc2626',
          'line-width': 2,
          'line-dasharray': [4, 2],
        },
      });

      // Active chip being annotated (blue highlight)
      map.addLayer({
        id: ACTIVE_CHIP_LAYER,
        type: 'fill',
        source: ACTIVE_CHIP_SOURCE,
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: ACTIVE_CHIP_OUTLINE,
        type: 'line',
        source: ACTIVE_CHIP_SOURCE,
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
        },
      });

      // Chip fills (drawn first, underneath polygons)
      map.addLayer({
        id: POSITIVE_CHIPS_LAYER,
        type: 'fill',
        source: POSITIVE_CHIPS_SOURCE,
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': 0.2,
        },
      });

      map.addLayer({
        id: NEGATIVE_CHIPS_LAYER,
        type: 'fill',
        source: NEGATIVE_CHIPS_SOURCE,
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.2,
        },
      });

      // Saved polygons (within positive chips)
      map.addLayer({
        id: SAVED_POLYGONS_LAYER,
        type: 'fill',
        source: SAVED_POLYGONS_SOURCE,
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': 0.4,
        },
      });

      map.addLayer({
        id: SAVED_POLYGONS_OUTLINE,
        type: 'line',
        source: SAVED_POLYGONS_SOURCE,
        paint: {
          'line-color': '#15803d',
          'line-width': 2,
        },
      });

      // Pending polygons being drawn (yellow)
      map.addLayer({
        id: PENDING_POLYGONS_LAYER,
        type: 'fill',
        source: PENDING_POLYGONS_SOURCE,
        paint: {
          'fill-color': '#fbbf24',
          'fill-opacity': 0.4,
        },
      });

      map.addLayer({
        id: PENDING_POLYGONS_OUTLINE,
        type: 'line',
        source: PENDING_POLYGONS_SOURCE,
        paint: {
          'line-color': '#d97706',
          'line-width': 2,
        },
      });

      // Chip outlines (drawn on top so boundaries are visible)
      map.addLayer({
        id: POSITIVE_CHIPS_OUTLINE,
        type: 'line',
        source: POSITIVE_CHIPS_SOURCE,
        paint: {
          'line-color': '#16a34a',
          'line-width': 3,
        },
      });

      map.addLayer({
        id: NEGATIVE_CHIPS_OUTLINE,
        type: 'line',
        source: NEGATIVE_CHIPS_SOURCE,
        paint: {
          'line-color': '#dc2626',
          'line-width': 2,
        },
      });

      // Selected chip highlight (drawn on top of everything)
      map.addLayer({
        id: SELECTED_CHIP_LAYER,
        type: 'fill',
        source: SELECTED_CHIP_SOURCE,
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.25,
        },
      });

      map.addLayer({
        id: SELECTED_CHIP_OUTLINE,
        type: 'line',
        source: SELECTED_CHIP_SOURCE,
        paint: {
          'line-color': '#60a5fa',
          'line-width': 4,
        },
      });

      // Inference bounding box (amber/orange for drawing)
      map.addLayer({
        id: INFERENCE_BOUNDS_LAYER,
        type: 'fill',
        source: INFERENCE_BOUNDS_SOURCE,
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.2,
        },
      });

      map.addLayer({
        id: INFERENCE_BOUNDS_OUTLINE,
        type: 'line',
        source: INFERENCE_BOUNDS_SOURCE,
        paint: {
          'line-color': '#d97706',
          'line-width': 3,
          'line-dasharray': [4, 2],
        },
      });

      // Inference overlay (probability heatmap)
      map.addLayer({
        id: INFERENCE_OVERLAY_LAYER,
        type: 'raster',
        source: INFERENCE_OVERLAY_SOURCE,
        paint: {
          'raster-opacity': 0.6,
        },
      });
    });

    mapRef.current = map;
    drawRef.current = draw;

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Handle draw.create event for polygons (during annotation)
  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;

    const handleDrawCreate = (e) => {
      if (!isAnnotating) return;

      const features = e.features;
      features.forEach((feature) => {
        if (feature.geometry.type === 'Polygon') {
          onAddPendingPolygon(feature.geometry);
          draw.delete(feature.id);
        }
      });

      // Defer mode change to allow mapbox-gl-draw to finish processing
      setTimeout(() => {
        if (drawRef.current) {
          drawRef.current.changeMode('draw_polygon');
        }
      }, 0);
    };

    map.on('draw.create', handleDrawCreate);

    return () => {
      map.off('draw.create', handleDrawCreate);
    };
  }, [isAnnotating, onAddPendingPolygon]);

  // Handle map clicks for chip placement/selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e) => {
      if (isAnnotating) return; // Don't handle clicks while annotating

      const { lng, lat } = e.lngLat;
      const snappedCenter = snapToChipGrid(lng, lat);

      if (labelType === LABEL_TYPES.NEGATIVE) {
        onNegativeChipPlace(snappedCenter.lng, snappedCenter.lat);
      } else if (labelType === LABEL_TYPES.POSITIVE) {
        onStartAnnotation(snappedCenter);
      }
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [labelType, isAnnotating, onNegativeChipPlace, onStartAnnotation]);

  // Handle click on chips for selection (only in SELECT mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleChipClick = (e) => {
      if (isAnnotating || labelType !== LABEL_TYPES.SELECT) return;
      e.preventDefault();
      e.originalEvent.stopPropagation();

      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const chipId = feature.properties.id;
        onChipSelect(chipId);
      }
    };

    // Handle click on empty map area to deselect
    const handleMapClick = (e) => {
      if (isAnnotating || labelType !== LABEL_TYPES.SELECT) return;

      // Check if click was on a chip layer - if so, the chip handler will handle it
      const features = map.queryRenderedFeatures(e.point, {
        layers: [POSITIVE_CHIPS_LAYER, NEGATIVE_CHIPS_LAYER],
      });

      if (features.length === 0) {
        // Clicked on empty area - deselect
        onChipSelect(null);
      }
    };

    map.on('click', POSITIVE_CHIPS_LAYER, handleChipClick);
    map.on('click', NEGATIVE_CHIPS_LAYER, handleChipClick);
    map.on('click', handleMapClick);

    // Change cursor on hover over chips (only in SELECT mode)
    map.on('mouseenter', POSITIVE_CHIPS_LAYER, () => {
      if (!isAnnotating && labelType === LABEL_TYPES.SELECT) {
        map.getCanvas().style.cursor = 'pointer';
      }
    });
    map.on('mouseleave', POSITIVE_CHIPS_LAYER, () => {
      if (isAnnotating) {
        map.getCanvas().style.cursor = '';
      } else if (labelType === LABEL_TYPES.SELECT) {
        map.getCanvas().style.cursor = 'default';
      } else {
        map.getCanvas().style.cursor = 'crosshair';
      }
    });
    map.on('mouseenter', NEGATIVE_CHIPS_LAYER, () => {
      if (!isAnnotating && labelType === LABEL_TYPES.SELECT) {
        map.getCanvas().style.cursor = 'pointer';
      }
    });
    map.on('mouseleave', NEGATIVE_CHIPS_LAYER, () => {
      if (isAnnotating) {
        map.getCanvas().style.cursor = '';
      } else if (labelType === LABEL_TYPES.SELECT) {
        map.getCanvas().style.cursor = 'default';
      } else {
        map.getCanvas().style.cursor = 'crosshair';
      }
    });

    return () => {
      map.off('click', POSITIVE_CHIPS_LAYER, handleChipClick);
      map.off('click', NEGATIVE_CHIPS_LAYER, handleChipClick);
      map.off('click', handleMapClick);
    };
  }, [isAnnotating, labelType, onChipSelect]);

  // Update draw mode based on annotation state
  useEffect(() => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;

    if (isAnnotating) {
      draw.changeMode('draw_polygon');
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      draw.changeMode('simple_select');
      map.getCanvas().style.cursor = labelType === LABEL_TYPES.SELECT ? 'default' : 'crosshair';
    }
  }, [isAnnotating, labelType]);

  // Update preview chip color based on label type
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const color = labelType === LABEL_TYPES.POSITIVE ? '#16a34a' : '#dc2626';
    map.setPaintProperty(PREVIEW_CHIP_LAYER, 'line-color', color);
  }, [labelType]);

  // Show preview chip on hover (snapped to grid) - only in POSITIVE/NEGATIVE modes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMouseMove = (e) => {
      // Hide preview while annotating or in SELECT mode
      if (isAnnotating || labelType === LABEL_TYPES.SELECT) {
        const previewSource = map.getSource(PREVIEW_CHIP_SOURCE);
        if (previewSource) {
          previewSource.setData({ type: 'FeatureCollection', features: [] });
        }
        return;
      }

      const { lng, lat } = e.lngLat;
      const snappedCenter = snapToChipGrid(lng, lat);
      const previewSource = map.getSource(PREVIEW_CHIP_SOURCE);

      if (previewSource) {
        const chipGeometry = createChipFromCenter(snappedCenter.lng, snappedCenter.lat);
        const chipFeature = {
          type: 'Feature',
          properties: {},
          geometry: chipGeometry,
        };

        previewSource.setData({
          type: 'FeatureCollection',
          features: [chipFeature],
        });
      }
    };

    const handleMouseLeave = () => {
      const previewSource = map.getSource(PREVIEW_CHIP_SOURCE);
      if (previewSource) {
        previewSource.setData({ type: 'FeatureCollection', features: [] });
      }
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseleave', handleMouseLeave);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseleave', handleMouseLeave);
    };
  }, [isAnnotating, labelType]);

  // Update active chip display
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const activeSource = map.getSource(ACTIVE_CHIP_SOURCE);
    if (activeSource) {
      if (activeChipCenter) {
        const chipGeometry = createChipFromCenter(activeChipCenter.lng, activeChipCenter.lat);
        activeSource.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: chipGeometry }],
        });
      } else {
        activeSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [activeChipCenter, mapLoaded]);

  // Update pending polygons display
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const pendingSource = map.getSource(PENDING_POLYGONS_SOURCE);
    if (pendingSource) {
      pendingSource.setData({
        type: 'FeatureCollection',
        features: pendingPolygons.map((geometry, idx) => ({
          type: 'Feature',
          id: `pending-${idx}`,
          properties: {},
          geometry,
        })),
      });
    }
  }, [pendingPolygons, mapLoaded]);

  // Update chip layers when chips change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const positiveSource = map.getSource(POSITIVE_CHIPS_SOURCE);
    const negativeSource = map.getSource(NEGATIVE_CHIPS_SOURCE);

    if (positiveSource) {
      positiveSource.setData(chipsToFeatureCollection(chips, 'positive'));
    }
    if (negativeSource) {
      negativeSource.setData(chipsToFeatureCollection(chips, 'negative'));
    }
  }, [chips, mapLoaded]);

  // Update saved polygons layer when polygons change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const polygonSource = map.getSource(SAVED_POLYGONS_SOURCE);
    if (polygonSource) {
      polygonSource.setData(polygonsToFeatureCollection(polygons));
    }
  }, [polygons, mapLoaded]);

  // Update selected chip highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const selectedSource = map.getSource(SELECTED_CHIP_SOURCE);
    if (selectedSource) {
      if (selectedChipId) {
        const selectedChip = chips.find((c) => c.id === selectedChipId);
        if (selectedChip) {
          selectedSource.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { id: selectedChip.id },
                geometry: selectedChip.geometry,
              },
            ],
          });
        } else {
          selectedSource.setData({ type: 'FeatureCollection', features: [] });
        }
      } else {
        selectedSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [selectedChipId, chips, mapLoaded]);

  // Handle ESC key to cancel bounding box drawing
  useEffect(() => {
    if (!isDrawingBounds) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setBoundsStart(null);
        setCurrentBounds(null);
        onCancelBoundsDrawing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawingBounds, onCancelBoundsDrawing]);

  // Handle bounding box drawing mouse events
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!isDrawingBounds) {
      // Clear any bounds drawing state when not in drawing mode
      setBoundsStart(null);
      setCurrentBounds(null);
      const boundsSource = map.getSource(INFERENCE_BOUNDS_SOURCE);
      if (boundsSource) {
        boundsSource.setData({ type: 'FeatureCollection', features: [] });
      }
      return;
    }

    // Set cursor for drawing mode
    map.getCanvas().style.cursor = 'crosshair';

    const handleMouseDown = (e) => {
      if (!isDrawingBounds) return;
      const { lng, lat } = e.lngLat;
      setBoundsStart({ lng, lat });
    };

    const handleMouseMove = (e) => {
      if (!boundsStart) return;
      const { lng, lat } = e.lngLat;

      const west = Math.min(boundsStart.lng, lng);
      const east = Math.max(boundsStart.lng, lng);
      const south = Math.min(boundsStart.lat, lat);
      const north = Math.max(boundsStart.lat, lat);

      const bounds = { west, south, east, north };
      setCurrentBounds(bounds);

      // Update the visual preview
      const boundsSource = map.getSource(INFERENCE_BOUNDS_SOURCE);
      if (boundsSource) {
        boundsSource.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
              ]],
            },
          }],
        });
      }
    };

    const handleMouseUp = () => {
      if (!boundsStart || !currentBounds) return;

      // Check if bounds are valid (not just a click)
      const minSize = 0.001; // ~100m at equator
      if (
        Math.abs(currentBounds.east - currentBounds.west) > minSize &&
        Math.abs(currentBounds.north - currentBounds.south) > minSize
      ) {
        onBoundsDrawn(currentBounds);
      }

      setBoundsStart(null);
      setCurrentBounds(null);
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.getCanvas().style.cursor = labelType === LABEL_TYPES.SELECT ? 'default' : 'crosshair';
    };
  }, [isDrawingBounds, boundsStart, currentBounds, mapLoaded, onBoundsDrawn, labelType]);

  // Update inference overlay display
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (showInferenceOverlay && inferenceOverlay) {
      const { url, bounds } = inferenceOverlay;

      // Update the image source
      const source = map.getSource(INFERENCE_OVERLAY_SOURCE);
      if (source) {
        source.updateImage({
          url,
          coordinates: [
            [bounds.west, bounds.north],
            [bounds.east, bounds.north],
            [bounds.east, bounds.south],
            [bounds.west, bounds.south],
          ],
        });
      }

      // Show the layer
      map.setLayoutProperty(INFERENCE_OVERLAY_LAYER, 'visibility', 'visible');
    } else {
      // Hide the layer
      if (map.getLayer(INFERENCE_OVERLAY_LAYER)) {
        map.setLayoutProperty(INFERENCE_OVERLAY_LAYER, 'visibility', 'none');
      }
    }
  }, [showInferenceOverlay, inferenceOverlay, mapLoaded]);

  return <div ref={mapContainerRef} className="map-container" />;
}

MapContainer.propTypes = {
  labelType: PropTypes.string.isRequired,
  isAnnotating: PropTypes.bool.isRequired,
  activeChipCenter: PropTypes.object,
  pendingPolygons: PropTypes.array.isRequired,
  polygons: PropTypes.array.isRequired,
  chips: PropTypes.array.isRequired,
  onStartAnnotation: PropTypes.func.isRequired,
  onAddPendingPolygon: PropTypes.func.isRequired,
  onNegativeChipPlace: PropTypes.func.isRequired,
  onChipSelect: PropTypes.func.isRequired,
  selectedChipId: PropTypes.string,
  isDrawingBounds: PropTypes.bool,
  onBoundsDrawn: PropTypes.func,
  onCancelBoundsDrawing: PropTypes.func,
  inferenceOverlay: PropTypes.shape({
    url: PropTypes.string.isRequired,
    bounds: PropTypes.shape({
      west: PropTypes.number.isRequired,
      south: PropTypes.number.isRequired,
      east: PropTypes.number.isRequired,
      north: PropTypes.number.isRequired,
    }).isRequired,
  }),
  showInferenceOverlay: PropTypes.bool,
};

export default MapContainer;
