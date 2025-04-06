import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Geodetic, radians } from '@takram/three-geospatial';
import * as THREE from 'three';
import { useAtomValue } from 'jotai';
import { geojsonDataAtom, GeoJsonFeature } from '../services/SimulationService';
import { addDebugMessage } from './InfoPanel';

// Define a constant for the object scale to make it more visible
const OBJECT_SCALE = 100.0;

// Define a height offset to position objects above the surface
// This offset will be added to the detected surface height
const HEIGHT_OFFSET = 20; // meters above detected surface

// Default height if raycast fails
const DEFAULT_HEIGHT = 20; // meters


// Helper function to convert lat/lng to 3D position
const latLngToVector3 = (lat: number, lng: number, height: number = 0): THREE.Vector3 => {
  const geodetic = new Geodetic(radians(lng), radians(lat), height);
  const position = new THREE.Vector3();
  geodetic.toECEF(position);
  return position;
};

// Helper to create a mesh based on GeoJSON Feature properties
const createMeshFromFeature = (feature: GeoJsonFeature): THREE.Group | null => {
  if (!feature || !feature.geometry || !feature.properties) return null;

  const { type } = feature.geometry;
  const properties = feature.properties || {};

  // Get color from properties or use default
  const color = properties.color || '#FF0000'; // Default to red

  // Create materials with better visual appearance
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    transparent: properties.opacity ? properties.opacity < 1.0 : true, // Use opacity from props if available
    opacity: properties.opacity ?? 0.8, // Default opacity
    side: THREE.DoubleSide,
    metalness: properties.metalness ?? 0.2,
    roughness: properties.roughness ?? 0.5,
    clearcoat: properties.clearcoat ?? 0.5,
    clearcoatRoughness: properties.clearcoatRoughness ?? 0.2,
    emissive: new THREE.Color(color).multiplyScalar(properties.emissiveIntensity ?? 0.2),
  });

  // Determine geometry based on feature type or properties
  let geometry: THREE.BufferGeometry;
  const scale = properties.scale ?? OBJECT_SCALE;

  // Example: Use different shapes based on properties
  if (properties.shape === 'sphere') {
      geometry = new THREE.SphereGeometry(scale / 2, 32, 16); // Radius is half the scale
  } else if (properties.shape === 'cylinder') {
      geometry = new THREE.CylinderGeometry(scale / 2, scale / 2, scale, 32);
  } else { // Default to Box
      geometry = new THREE.BoxGeometry(scale, scale, scale);
  }


  // Create the mesh
  const mesh = new THREE.Mesh(geometry, material);

  // Add wireframe for better visibility during debugging if needed
  const group = new THREE.Group();
  group.add(mesh);

  // --- Debugging ---
  // const wireframe = new THREE.WireframeGeometry(geometry);
  // const line = new THREE.LineSegments(wireframe);
  // line.material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  // group.add(line);
  // Add axes helper for orientation debugging
  // const axesHelper = new THREE.AxesHelper(scale * 1.5);
  // group.add(axesHelper);
  // -------------

  // Set mesh name from properties if available
  if (properties.name) {
     group.name = `GeoJSON-${properties.name}`;
  } else {
     group.name = `GeoJSON-Object`;
  }

  console.log(`[GeoJSONContainer] Created mesh group: ${group.name}`, { properties, scale });
  addDebugMessage(`[GeoJSON] Created ${group.name}`);

  return group;
};

export const GeoJSONContainer: React.FC = () => {
  const geoJsonState = useAtomValue(geojsonDataAtom); // Subscribe to the atom
  const { scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const tilesRef = useRef<THREE.Group | null>(null); // Ref to the map tiles group
  const currentMeshGroupRef = useRef<THREE.Group | null>(null); // Ref to the currently added mesh group

  useEffect(() => {
    // --- Cleanup previous mesh ---
    if (currentMeshGroupRef.current) {
      console.log(`[GeoJSONContainer] Removing previous mesh: ${currentMeshGroupRef.current.name}`);
      addDebugMessage(`[GeoJSON] Removing ${currentMeshGroupRef.current.name}`);
      scene.remove(currentMeshGroupRef.current);
      // Dispose geometry/material if necessary to prevent memory leaks, depending on complexity
      // currentMeshGroupRef.current.traverse(child => { ... dispose ... });
      currentMeshGroupRef.current = null;
    }

    // --- Process new data ---
    if (!geoJsonState || !geoJsonState.feature) {
      console.log('[GeoJSONContainer] No valid GeoJSON feature data in atom, clearing.');
      addDebugMessage(`[GeoJSON] Cleared`);
      return; // Nothing to render
    }

    const feature = geoJsonState.feature;
    console.log('[GeoJSONContainer] Processing new GeoJSON feature:', feature);

    let coordinates: [number, number] | null = null;

    // Extract coordinates (only handle Point for now, add LineString/Polygon later if needed)
    if (feature.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length >= 2) {
        coordinates = [feature.geometry.coordinates[0], feature.geometry.coordinates[1]] as [number, number];
    } else {
        console.error('[GeoJSONContainer] Invalid or unsupported geometry type:', feature.geometry?.type);
        addDebugMessage(`[GeoJSON] Error: Invalid geometry ${feature.geometry?.type}`);
        return;
    }

    if (typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
       console.error('[GeoJSONContainer] Invalid coordinates format:', coordinates);
       addDebugMessage(`[GeoJSON] Error: Invalid coords format`);
       return;
    }

    // Create the mesh group
    const meshGroup = createMeshFromFeature(feature);
    if (!meshGroup) {
      console.error('[GeoJSONContainer] Failed to create mesh from GeoJSON feature.');
      addDebugMessage(`[GeoJSON] Error: Mesh creation failed`);
      return;
    }

    // Position the mesh at the coordinates
    const [lng, lat] = coordinates;
    const basePosition = latLngToVector3(lat, lng, 0); // Position on ellipsoid surface

    // Find the map tiles group if not already found (do this once)
    if (!tilesRef.current) {
      scene.traverse((object) => {
        // Adjust name check based on how your tiles are named/structured
        if (object.name === 'Map Tiles Root' || object.name.includes('Tiles') || object.userData?.isMapTileGroup) {
          console.log('[GeoJSONContainer] Found map tiles group:', object.name);
           addDebugMessage(`[GeoJSON] Found map tiles: ${object.name}`);
          tilesRef.current = object as THREE.Group;
        }
      });
       if (!tilesRef.current) {
            console.warn('[GeoJSONContainer] Could not find map tiles group in the scene for raycasting.');
            addDebugMessage(`[GeoJSON] Warn: Tiles group not found for raycasting`);
       }
    }

    // Determine the height using raycasting against the tiles
    let finalHeight = DEFAULT_HEIGHT; // Default height offset

    if (tilesRef.current) {
      // Raycast setup
      const direction = basePosition.clone().normalize(); // Direction from earth center through the point
      const near = basePosition.length() - 1000; // Start slightly below surface
      const far = basePosition.length() + 5000; // Check reasonably far out

      raycaster.current.near = near;
      raycaster.current.far = far;
       // Optimization: Set layer for raycaster if tiles are on a specific layer
      // raycaster.current.layers.set(TILE_LAYER);

      raycaster.current.set(direction.clone().multiplyScalar(near), direction); // Start ray inside, point outwards

      const intersects = raycaster.current.intersectObject(tilesRef.current, true);

      if (intersects.length > 0) {
        // Use the first intersection point's distance from origin
        const surfaceHeight = intersects[0].point.length();
        // Calculate height relative to the ellipsoid surface at that lat/lng
        const heightAboveEllipsoid = surfaceHeight - basePosition.length();
        finalHeight = heightAboveEllipsoid + HEIGHT_OFFSET;

        console.log(`[GeoJSONContainer] Raycast hit. Surface height: ${surfaceHeight.toFixed(2)}, Height above ellipsoid: ${heightAboveEllipsoid.toFixed(2)}, Final height: ${finalHeight.toFixed(2)}`);
         addDebugMessage(`[GeoJSON] Raycast hit, height: ${finalHeight.toFixed(0)}m`);
      } else {
        console.log('[GeoJSONContainer] Raycast miss, using default height offset.');
         addDebugMessage(`[GeoJSON] Raycast miss, using default height ${finalHeight}m`);
         // Optionally increase default height if raycast misses often in expected areas
         // finalHeight = DEFAULT_HEIGHT * 5;
      }
    } else {
       console.log('[GeoJSONContainer] No tiles group for raycasting, using default height offset.');
       addDebugMessage(`[GeoJSON] No tiles for raycast, using default height ${finalHeight}m`);
       // Optionally increase default height if no tiles found
       // finalHeight = DEFAULT_HEIGHT * 5;
    }

    // Set final position and orientation
    const finalPosition = latLngToVector3(lat, lng, finalHeight);
    meshGroup.position.copy(finalPosition);

    // Orient the mesh group to be perpendicular to the surface (up vector = normalized position)
    const upVector = finalPosition.clone().normalize();
    meshGroup.lookAt(finalPosition.clone().add(upVector)); // Point "up" away from earth center
    meshGroup.rotateX(Math.PI / 2); // Correct orientation if default mesh faces Z+

    // Add the new mesh group to the scene
    scene.add(meshGroup);
    currentMeshGroupRef.current = meshGroup; // Store ref to the new mesh group

    console.log(`[GeoJSONContainer] Added ${meshGroup.name} to scene at`, finalPosition.toArray());
     addDebugMessage(`[GeoJSON] Added ${meshGroup.name}`);

    // Log details for debugging
    console.log('[GeoJSONContainer] Added GeoJSON object details:', {
      name: meshGroup.name,
      position: finalPosition.toArray(),
      coordinates: coordinates,
      meshProperties: {
         // Add relevant mesh/group properties if needed for debugging
         worldPosition: meshGroup.getWorldPosition(new THREE.Vector3()).toArray(),
      },
    });

  }, [geoJsonState, scene]); // Rerun effect when atom value or scene changes

  // This component doesn't render anything directly to the DOM
  return null;
};

export default GeoJSONContainer;
