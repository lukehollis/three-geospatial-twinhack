import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
// import { useFrame } from '@react-three/fiber'; // Not needed for animation yet
import { RiskPoint, getRiskWeightAtPoint, getColorFromGradient } from '../hooks/useRiskAssessment';
// Ensure these geospatial utilities are correctly implemented and imported
import { calculateCartesianFromGeodetic, calculateGeodeticFromCartesian } from '../utils/geospatial';
// Using turf for distance calculation might be removed if getRiskWeightAtPoint handles it
// import { distance } from '@turf/turf';

// --- Debug Flag ---
const DEBUG_PLANE_ONLY = false; // Set to true to see the basic green plane position/orientation

// Define props for the new component
interface ThreeRiskHeatmapProps {
  segmentPath: [number, number][]; // Path for this specific segment [lng, lat]
  riskPoints?: RiskPoint[];
  visible?: boolean;
  displacementScale?: number;
  resolution?: number; // Texture resolution
  width?: number; // Width of the heatmap plane in world units
  baseElevation?: number; // Prop to control base height above surface
}

// Define bounds structure - might not be needed if we map directly
// interface Bounds { ... }

const ThreeRiskHeatmap: React.FC<ThreeRiskHeatmapProps> = ({
  segmentPath,
  riskPoints,
  visible = true,
  displacementScale = 50.0, // Adjust scale based on world units
  resolution = 32, // Keep resolution lower for performance initially
  width = 100, // Width of the plane in world units
  baseElevation = 20, // Increased base elevation considerably
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  // Refs for textures and material are not strictly necessary unless updated outside useMemo
  // const textureRef = useRef<THREE.DataTexture | null>(null);
  // const materialRef = useRef<THREE.MeshPhongMaterial | null>(null);

  // 1. Calculate Geometry, Position, Orientation based on segmentPath
  const { geometry, position, quaternion, planeLength, planeWidth } = useMemo(() => {
    if (!segmentPath || segmentPath.length < 2) {
      return { geometry: undefined, position: undefined, quaternion: undefined, planeLength: 0, planeWidth: 0 };
    }

    const startPoint = segmentPath[0];
    const endPoint = segmentPath[segmentPath.length - 1];
    // Use the baseElevation prop
    const startCoords = calculateCartesianFromGeodetic(startPoint[1], startPoint[0], baseElevation);
    const endCoords = calculateCartesianFromGeodetic(endPoint[1], endPoint[0], baseElevation);

    const calculatedCenterPos = new THREE.Vector3().lerpVectors(startCoords, endCoords, 0.5);
    const segmentLength = startCoords.distanceTo(endCoords);
    const calculatedPlaneLength = segmentLength > 0 ? segmentLength : 1; // Avoid zero length
    const calculatedPlaneWidth = width;

    // Create Plane Geometry - Assuming default orientation is XY plane, normal along +Z
    const geom = new THREE.PlaneGeometry(
      calculatedPlaneLength,
      calculatedPlaneWidth,
      resolution - 1,
      resolution - 1
    );

    // Calculate Orientation Quaternion
    const direction = new THREE.Vector3().subVectors(endCoords, startCoords).normalize();
    const up = new THREE.Vector3(0, 1, 0); // Assuming world UP is +Y
    const calculatedQuaternion = new THREE.Quaternion();

    // Create a matrix that aligns the plane's local axes:
    // Z (normal) -> World UP (approx)
    // X (length) -> Segment Direction
    // Y (width) -> Cross product (Direction x Up)
    const matrix = new THREE.Matrix4();
    const tangent = direction; // Align X with direction
    const normal = up.clone().projectOnPlane(tangent).normalize(); // Approximate normal (world up projected)
    // If direction is parallel to UP, normal calculation fails. Add fallback.
    if (normal.lengthSq() < 0.001) {
        // If segment is vertical, choose an arbitrary perpendicular normal like world X
        normal.set(1, 0, 0).projectOnPlane(tangent).normalize();
         if (normal.lengthSq() < 0.001) normal.set(0, 0, 1); // Fallback further if needed
    }

    const bitangent = new THREE.Vector3().crossVectors(tangent, normal).normalize(); // Align Y with width direction

    matrix.makeBasis(tangent, bitangent, normal); // Set rotation matrix columns
    calculatedQuaternion.setFromRotationMatrix(matrix);

    return {
        geometry: geom,
        position: calculatedCenterPos,
        quaternion: calculatedQuaternion,
        planeLength: calculatedPlaneLength,
        planeWidth: calculatedPlaneWidth
    };

  }, [segmentPath, width, resolution, baseElevation]);

  // 2. Generate Data Texture based on riskPoints and plane's transform
  const { displacementMap, colorMap } = useMemo(() => {
     // Ensure we have valid geometry, position, quaternion, and risk points
     if (DEBUG_PLANE_ONLY || !geometry || !position || !quaternion || !riskPoints || planeLength <= 0 || planeWidth <= 0) {
        // Return simple white texture for debug or if data missing
        const whiteData = new Uint8Array(resolution * resolution * 4).fill(255);
        const whiteTexture = new THREE.DataTexture(whiteData, resolution, resolution, THREE.RGBAFormat);
        whiteTexture.needsUpdate = true;
        return { displacementMap: whiteTexture, colorMap: whiteTexture }; // Use white for both
     }

     const size = resolution * resolution * 4; // RGBA
     const colorData = new Uint8Array(size);
     const displacementData = new Uint8Array(size);
     const localPosition = new THREE.Vector3();
     const worldPosition = new THREE.Vector3();

     console.log(`[ThreeRiskHeatmap] Generating texture for segment centered at ${position.toArray().map(n => n.toFixed(1))}`);

     // --- generateHeatmapData Logic ---
     let minWeight = 1.0;
     let maxWeight = 0.0;
     for (let y = 0; y < resolution; y++) { // V coordinate (plane height/width)
       for (let x = 0; x < resolution; x++) { // U coordinate (plane length)
         const index = (y * resolution + x) * 4;

         // Map texture coordinates (u,v) [0,1] to LOCAL position on the plane
         const u = x / (resolution - 1);
         const v = y / (resolution - 1);
         // PlaneGeometry is in XY plane by default if not rotated in useMemo
         // Assuming PlaneGeometry default: width is X, height is Y
         localPosition.set(
             (u - 0.5) * planeLength, // Maps to plane's local X (length)
             (v - 0.5) * planeWidth,  // Maps to plane's local Y (width)
             0                         // Z is 0 on the plane itself
         );

         // Transform LOCAL position to WORLD position
         worldPosition.copy(localPosition).applyQuaternion(quaternion).add(position);

         // Convert WORLD position (Cartesian) back to GEOGRAPHIC (Lat, Lng)
         const geoCoords = calculateGeodeticFromCartesian(worldPosition);
         const lat = geoCoords.latitude;
         const lng = geoCoords.longitude;
         // const alt = geoCoords[2]; // Altitude might be useful

         // Get risk weight at this geographic point
         // Adjust maxDistance based on typical risk point density and segment size
         const weight = getRiskWeightAtPoint(lat, lng, riskPoints, 2.0); // Max distance 2 km
         minWeight = Math.min(minWeight, weight);
         maxWeight = Math.max(maxWeight, weight);

         // Get color from gradient
         const riskColor = getColorFromGradient(weight);
         const displacementVal = Math.floor(weight * 255);

         // Store color in colorData
         colorData[index] = riskColor[0];     // R
         colorData[index + 1] = riskColor[1]; // G
         colorData[index + 2] = riskColor[2]; // B
         colorData[index + 3] = 255;          // A (Opaque)

         // Store grayscale displacement value in displacementData
         displacementData[index] = displacementVal;     // R
         displacementData[index + 1] = displacementVal; // G
         displacementData[index + 2] = displacementVal; // B
         displacementData[index + 3] = 255;             // A
       }
     }
     console.log(`[ThreeRiskHeatmap] Texture generated. Weight range: ${minWeight.toFixed(2)} - ${maxWeight.toFixed(2)}`);

     const dMap = new THREE.DataTexture(displacementData, resolution, resolution, THREE.RGBAFormat);
     dMap.needsUpdate = true;

     const cMap = new THREE.DataTexture(colorData, resolution, resolution, THREE.RGBAFormat);
     cMap.needsUpdate = true;

     return { displacementMap: dMap, colorMap: cMap };

  }, [geometry, position, quaternion, riskPoints, resolution, planeLength, planeWidth]); // Dependencies

  // 3. Create Material
  const material = useMemo(() => {
      // Simple Green Debug Material
      if (DEBUG_PLANE_ONLY) {
          return new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
      }

      // Normal Heatmap Material
      if (!displacementMap || !colorMap) return undefined;

      return new THREE.MeshPhongMaterial({
          map: colorMap,
          displacementMap: displacementMap,
          displacementScale: displacementScale,
          displacementBias: 0.1, // Small positive bias to lift slightly off base elevation
          shininess: 5, // Low shininess
          specular: 0x111111,
          side: THREE.DoubleSide,
      });
  }, [colorMap, displacementMap, displacementScale]);

  // No separate useEffect for position/rotation needed if done in useMemo and mesh created directly

  if (!geometry || !material || !position || !quaternion) {
    console.log("[ThreeRiskHeatmap] Skipping render: Missing geometry, material, position, or quaternion.");
    return null; // Don't render if essential parts are missing
  }

  // Render the mesh with calculated properties
  return (
    <mesh
      // ref={meshRef} // Ref might not be needed unless interacting with it
      geometry={geometry}
      material={material}
      position={position} // Apply calculated position
      quaternion={quaternion} // Apply calculated orientation
      visible={visible}
    />
  );
};

export default ThreeRiskHeatmap;

// Remove other exports related to the old class structure
// export { fetchRouteRiskAssessment, generateRouteRiskPoints }; // Remove these