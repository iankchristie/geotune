import { useState, useCallback } from 'react';
import { createChipFromCenter } from '../components/Map/chipUtils';

let polygonIdCounter = 0;
let chipIdCounter = 0;

function generatePolygonId() {
  return `polygon-${++polygonIdCounter}`;
}

function generateChipId() {
  return `chip-${++chipIdCounter}`;
}

/**
 * Extract the numeric ID from a string ID like 'chip-5' or 'polygon-10'
 * @param {string} id - ID string
 * @returns {number} Numeric portion of the ID
 */
function extractIdNumber(id) {
  const match = id.match(/\d+$/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Sync ID counters to continue from the highest loaded ID
 * @param {Array} chips - Array of chip objects
 * @param {Array} polygons - Array of polygon objects
 */
function syncIdCounters(chips, polygons) {
  let maxChipId = 0;
  let maxPolygonId = 0;

  chips.forEach((chip) => {
    const num = extractIdNumber(chip.id);
    if (num > maxChipId) maxChipId = num;
  });

  polygons.forEach((polygon) => {
    const num = extractIdNumber(polygon.id);
    if (num > maxPolygonId) maxPolygonId = num;
  });

  chipIdCounter = maxChipId;
  polygonIdCounter = maxPolygonId;
}

/**
 * Hook for managing label state (polygons and chips)
 */
export default function useLabels() {
  const [polygons, setPolygons] = useState([]);
  const [chips, setChips] = useState([]);

  /**
   * Add a positive chip at the specified center with associated polygons
   * @param {Object} center - {lng, lat} center of the chip
   * @param {Array} polygonGeometries - Array of GeoJSON polygon geometries drawn within the chip
   */
  const addPositiveChipWithPolygons = useCallback((center, polygonGeometries) => {
    const chipId = generateChipId();
    const chipGeometry = createChipFromCenter(center.lng, center.lat);

    // Create the chip
    const newChip = {
      id: chipId,
      geometry: chipGeometry,
      center,
      type: 'positive',
      createdAt: new Date().toISOString(),
    };

    // Create polygon records linked to this chip
    const newPolygons = polygonGeometries.map((geometry) => ({
      id: generatePolygonId(),
      chipId,
      geometry,
      createdAt: new Date().toISOString(),
    }));

    setChips((prev) => [...prev, newChip]);
    setPolygons((prev) => [...prev, ...newPolygons]);

    return { chip: newChip, polygons: newPolygons };
  }, []);

  /**
   * Add a negative chip at the specified center point
   * @param {number} lng - Longitude of chip center
   * @param {number} lat - Latitude of chip center
   */
  const addNegativeChip = useCallback((lng, lat) => {
    const chipGeometry = createChipFromCenter(lng, lat);

    const newChip = {
      id: generateChipId(),
      geometry: chipGeometry,
      center: { lng, lat },
      type: 'negative',
      createdAt: new Date().toISOString(),
    };

    setChips((prev) => [...prev, newChip]);

    return newChip;
  }, []);

  /**
   * Delete a chip and its associated polygons
   * @param {string} chipId - ID of chip to delete
   */
  const deleteChip = useCallback((chipId) => {
    setChips((prev) => prev.filter((c) => c.id !== chipId));
    setPolygons((prev) => prev.filter((p) => p.chipId !== chipId));
  }, []);

  /**
   * Delete a single polygon (keeps the chip)
   * @param {string} polygonId - ID of polygon to delete
   */
  const deletePolygon = useCallback((polygonId) => {
    setPolygons((prev) => prev.filter((p) => p.id !== polygonId));
  }, []);

  /**
   * Clear all polygons and chips
   */
  const clearAll = useCallback(() => {
    setPolygons([]);
    setChips([]);
  }, []);

  /**
   * Set initial state from loaded data (e.g., from server)
   * Also syncs ID counters to continue from highest loaded ID
   * @param {Array} loadedChips - Array of chip objects
   * @param {Array} loadedPolygons - Array of polygon objects
   */
  const setInitialState = useCallback((loadedChips, loadedPolygons) => {
    syncIdCounters(loadedChips, loadedPolygons);
    setChips(loadedChips);
    setPolygons(loadedPolygons);
  }, []);

  return {
    polygons,
    chips,
    addPositiveChipWithPolygons,
    addNegativeChip,
    deleteChip,
    deletePolygon,
    clearAll,
    setInitialState,
  };
}
