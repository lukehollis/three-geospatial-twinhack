import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { calculateCartesianFromGeodetic } from '../utils/geospatialUtils';
import { Route } from '../services/SimulationService'; // Assuming basic Route type is sufficient
import * as THREE from 'three';

// Use a basic Route type, as detailedPath isn't expected for water
interface WaterRoute extends Route {}

interface RouteWaterProps {
  route: WaterRoute;
  color?: string;       // Blue for the main line
  glowColor?: string;   // White for the glow
  width?: number;
  opacity?: number;
}

const RouteWater: React.FC<RouteWaterProps> = ({
  route,
  color = '#1976D2', // Default blue color for water routes
  glowColor = '#FFFFFF', // Default white for the glow
  width = 5,
  opacity = 0.9
}) => {

  // Convert route waypoints to 3D points close to the surface
  const points = useMemo((): THREE.Vector3[] => {
    const elevation = 1; // Desired elevation above the visual surface

    if (!route.waypoints || route.waypoints.length < 2) {
      console.warn(`[RouteWater] Cannot render route ${route.id}: Invalid or missing waypoints.`);
      const defaultPoint = calculateCartesianFromGeodetic(0, 0, elevation);
      return [defaultPoint, defaultPoint];
    }
    
    const waypoints = route.waypoints;

    if (waypoints.length === 2) {
      // --- Generate intermediate points for a 2-point route ---
      console.log(`[RouteWater] Generating intermediate surface points for route ${route.id} using surface LERP`);
      const generatedPoints: THREE.Vector3[] = [];
      const segments = 30; // Number of segments for the surface curve

      const originLL = waypoints[0];
      const destLL = waypoints[1];

      // Calculate cartesian coordinates AT THE DESIRED ELEVATION using the utility
      const startSurfacePoint = calculateCartesianFromGeodetic(originLL[1], originLL[0], elevation); 
      const endSurfacePoint = calculateCartesianFromGeodetic(destLL[1], destLL[0], elevation);

      // Add start point
      generatedPoints.push(startSurfacePoint);

      // Loop for intermediate points (1 to segments-1)
      for (let i = 1; i < segments; i++) { 
        const t = i / segments;
        
        // Linearly interpolate directly between the start and end *surface* points
        const interpPoint = startSurfacePoint.clone().lerp(endSurfacePoint, t); 
        
        // --- CRITICAL: We need to project this interpolated point back onto the sphere surface ---
        // The direct lerp cuts through the sphere slightly. We normalize and scale back.
        const visualRadius = startSurfacePoint.length(); // Get radius from the utility's output
        interpPoint.normalize().multiplyScalar(visualRadius); 
        // --- End projection ---

        generatedPoints.push(interpPoint);
      }

      // Add end point
      generatedPoints.push(endSurfacePoint);
      
      return generatedPoints;
      // --- End intermediate point generation ---

    } else {
      // Use provided waypoints if more than two are given
      // Calculate each point directly at the desired elevation
      console.log(`[RouteWater] Using provided ${waypoints.length} waypoints for route ${route.id}`);
      return waypoints.map(([longitude, latitude]) =>
        calculateCartesianFromGeodetic(latitude, longitude, elevation)
      );
    }
  }, [route.waypoints, route.id]); 

  // Check if we have valid points to render
  if (points.length < 2) {
    return null; 
  }

  return (
    <>
      {/* Main route line (Blue) */}
      <Line
        points={points}
        color={color} 
        lineWidth={width}
        transparent={true}
        opacity={opacity}
        dashed={false} 
        depthTest={false} // Render on top of other objects
        renderOrder={1}   // Render main line after glow
      />

      {/* Glow effect (White) */}
      <Line
        points={points}
        color={glowColor} 
        lineWidth={width * 2} // Wider glow
        transparent={true}
        opacity={opacity * 0.4} // Subtle glow
        dashed={false}
        depthTest={false} // Render on top of other objects
        renderOrder={0}   // Render glow first (lower number = earlier)
      />

      {/* Optional: Markers for start/end if desired, similar to RouteVisualization */}
      {/* 
      <mesh position={points[0]}>
        <sphereGeometry args={[60, 16, 16]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.3} />
      </mesh>

      <mesh position={points[points.length - 1]}>
        <sphereGeometry args={[60, 16, 16]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.3} />
      </mesh> 
      */}
    </>
  );
};

export default RouteWater; 