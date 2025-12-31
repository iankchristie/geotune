import * as turf from '@turf/turf';
import { CHIP_SIZE_METERS } from '../../config';

/**
 * Convert meters to degrees latitude
 * Latitude degrees are constant: 1 degree = 111,320 meters
 * @param {number} meters - Distance in meters
 * @returns {number} Distance in degrees
 */
export function metersToDegreesLat(meters) {
  return meters / 111320;
}

/**
 * Convert meters to degrees longitude at a given latitude
 * Longitude degrees vary with latitude due to Earth's curvature
 * @param {number} meters - Distance in meters
 * @param {number} latitude - Latitude in degrees
 * @returns {number} Distance in degrees
 */
export function metersToDegreesLng(meters, latitude) {
  return meters / (111320 * Math.cos((latitude * Math.PI) / 180));
}

/**
 * Snap a coordinate to the nearest chip grid position
 * The grid is aligned so chip centers fall on regular intervals
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @returns {Object} Snapped {lng, lat} center point
 */
export function snapToChipGrid(lng, lat) {
  // Calculate chip size in degrees at this latitude
  const chipSizeLat = metersToDegreesLat(CHIP_SIZE_METERS);
  const chipSizeLng = metersToDegreesLng(CHIP_SIZE_METERS, lat);

  // Snap to nearest grid position
  // Grid starts at 0,0 with chip centers offset by half chip size
  const snappedLat = Math.round(lat / chipSizeLat) * chipSizeLat;
  const snappedLng = Math.round(lng / chipSizeLng) * chipSizeLng;

  return { lng: snappedLng, lat: snappedLat };
}

/**
 * Create a chip boundary polygon from a center point
 * Coordinates use [lng, lat] order (GeoJSON standard)
 * @param {number} centerLng - Center longitude
 * @param {number} centerLat - Center latitude
 * @returns {Object} GeoJSON Polygon geometry
 */
export function createChipFromCenter(centerLng, centerLat) {
  const halfSizeLat = metersToDegreesLat(CHIP_SIZE_METERS / 2);
  const halfSizeLng = metersToDegreesLng(CHIP_SIZE_METERS / 2, centerLat);

  return {
    type: 'Polygon',
    coordinates: [
      [
        [centerLng - halfSizeLng, centerLat - halfSizeLat],
        [centerLng + halfSizeLng, centerLat - halfSizeLat],
        [centerLng + halfSizeLng, centerLat + halfSizeLat],
        [centerLng - halfSizeLng, centerLat + halfSizeLat],
        [centerLng - halfSizeLng, centerLat - halfSizeLat],
      ],
    ],
  };
}

/**
 * Generate a grid of chip centers that cover a bounding box
 * @param {Array} bbox - Bounding box [minLng, minLat, maxLng, maxLat]
 * @returns {Array} Array of {lng, lat} center points
 */
function generateChipGrid(bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centers = [];

  // Calculate step sizes in degrees
  const stepLat = metersToDegreesLat(CHIP_SIZE_METERS);
  const centerLat = (minLat + maxLat) / 2;
  const stepLng = metersToDegreesLng(CHIP_SIZE_METERS, centerLat);

  // Start from the minimum corner and step through the grid
  // Add half step to center the first chip
  const startLat = minLat + stepLat / 2;
  const startLng = minLng + stepLng / 2;

  for (let lat = startLat; lat < maxLat; lat += stepLat) {
    // Recalculate longitude step for this latitude
    const currentStepLng = metersToDegreesLng(CHIP_SIZE_METERS, lat);
    for (let lng = startLng; lng < maxLng; lng += currentStepLng) {
      centers.push({ lng, lat });
    }
  }

  return centers;
}

/**
 * Generate chips that overlap with a polygon
 * @param {Object} polygonGeometry - GeoJSON Polygon geometry
 * @returns {Array} Array of chip objects with geometry and center
 */
export function generateChipsForPolygon(polygonGeometry) {
  const polygon = turf.polygon(polygonGeometry.coordinates);
  const bbox = turf.bbox(polygon);

  // Expand bbox by one chip size to ensure edge coverage
  const expandLat = metersToDegreesLat(CHIP_SIZE_METERS);
  const centerLat = (bbox[1] + bbox[3]) / 2;
  const expandLng = metersToDegreesLng(CHIP_SIZE_METERS, centerLat);

  const expandedBbox = [
    bbox[0] - expandLng,
    bbox[1] - expandLat,
    bbox[2] + expandLng,
    bbox[3] + expandLat,
  ];

  // Generate grid of potential chip centers
  const chipCenters = generateChipGrid(expandedBbox);

  // Filter to chips that intersect with the polygon
  const intersectingChips = [];

  for (const center of chipCenters) {
    const chipGeometry = createChipFromCenter(center.lng, center.lat);
    const chipPolygon = turf.polygon(chipGeometry.coordinates);

    if (turf.booleanIntersects(chipPolygon, polygon)) {
      intersectingChips.push({
        geometry: chipGeometry,
        center,
      });
    }
  }

  return intersectingChips;
}

/**
 * Convert chips array to GeoJSON FeatureCollection for map display
 * @param {Array} chips - Array of chip objects
 * @param {string} type - Filter by type ('positive', 'negative', or null for all)
 * @returns {Object} GeoJSON FeatureCollection
 */
export function chipsToFeatureCollection(chips, type = null) {
  const filteredChips = type ? chips.filter((c) => c.type === type) : chips;

  return {
    type: 'FeatureCollection',
    features: filteredChips.map((chip) => ({
      type: 'Feature',
      id: chip.id,
      properties: {
        id: chip.id,
        type: chip.type,
        polygonId: chip.polygonId,
      },
      geometry: chip.geometry,
    })),
  };
}

/**
 * Convert polygons array to GeoJSON FeatureCollection for map display
 * @param {Array} polygons - Array of polygon objects
 * @returns {Object} GeoJSON FeatureCollection
 */
export function polygonsToFeatureCollection(polygons) {
  return {
    type: 'FeatureCollection',
    features: polygons.map((polygon) => ({
      type: 'Feature',
      id: polygon.id,
      properties: {
        id: polygon.id,
      },
      geometry: polygon.geometry,
    })),
  };
}
