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

// Source IDs
const POSITIVE_CHIPS_SOURCE = 'positive-chips-source';
const NEGATIVE_CHIPS_SOURCE = 'negative-chips-source';
const PREVIEW_CHIP_SOURCE = 'preview-chip-source';
const ACTIVE_CHIP_SOURCE = 'active-chip-source';
const PENDING_POLYGONS_SOURCE = 'pending-polygons-source';
const SAVED_POLYGONS_SOURCE = 'saved-polygons-source';

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
  onChipDelete,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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

  // Handle click on chips for deletion
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleChipClick = (e) => {
      if (isAnnotating) return;
      e.preventDefault();

      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const chipId = feature.properties.id;

        if (window.confirm('Delete this chip?')) {
          onChipDelete(chipId);
        }
      }
    };

    map.on('click', POSITIVE_CHIPS_LAYER, handleChipClick);
    map.on('click', NEGATIVE_CHIPS_LAYER, handleChipClick);

    // Change cursor on hover over chips
    map.on('mouseenter', POSITIVE_CHIPS_LAYER, () => {
      if (!isAnnotating) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', POSITIVE_CHIPS_LAYER, () => {
      map.getCanvas().style.cursor = isAnnotating ? '' : 'crosshair';
    });
    map.on('mouseenter', NEGATIVE_CHIPS_LAYER, () => {
      if (!isAnnotating) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', NEGATIVE_CHIPS_LAYER, () => {
      map.getCanvas().style.cursor = isAnnotating ? '' : 'crosshair';
    });

    return () => {
      map.off('click', POSITIVE_CHIPS_LAYER, handleChipClick);
      map.off('click', NEGATIVE_CHIPS_LAYER, handleChipClick);
    };
  }, [isAnnotating, onChipDelete]);

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
      map.getCanvas().style.cursor = 'crosshair';
    }
  }, [isAnnotating]);

  // Update preview chip color based on label type
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const color = labelType === LABEL_TYPES.POSITIVE ? '#16a34a' : '#dc2626';
    map.setPaintProperty(PREVIEW_CHIP_LAYER, 'line-color', color);
  }, [labelType]);

  // Show preview chip on hover (snapped to grid)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMouseMove = (e) => {
      if (isAnnotating) {
        // Hide preview while annotating
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
  }, [isAnnotating]);

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
  onChipDelete: PropTypes.func.isRequired,
};

export default MapContainer;
