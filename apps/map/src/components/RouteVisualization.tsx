import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { calculateCartesianFromGeodetic } from '../utils/geospatial';
import { Route } from '../services/SimulationService';
import * as THREE from 'three';

// Expect the enhanced route potentially containing detailedPath and actorType
interface EnhancedRoute extends Route {
  actorType?: string;
  detailedPath?: [number, number][];
}

interface RouteVisualizationProps {
  route: EnhancedRoute; // Expect the enhanced route object
  color?: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
}

const RouteVisualization: React.FC<RouteVisualizationProps> = ({
  route,
  color = '#48aff0', // Default color for straight/fallback
  width = 5,
  opacity = 0.8,
  dashed = false
}) => {

  // Convert route waypoints or detailed path to 3D points
  const points = useMemo((): THREE.Vector3[] => {
    const elevation = 3; // Slightly above ground
    let pathSource = 'waypoints'; // For logging

    // Use detailed path if available and valid
    if (route.detailedPath && route.detailedPath.length >= 2) {
      pathSource = 'detailedPath';
      return route.detailedPath.map(([longitude, latitude]) =>
        calculateCartesianFromGeodetic(latitude, longitude, elevation)
      );
    }

    // Fallback: Use original waypoints
    if (!route.waypoints || route.waypoints.length < 2) {
      console.error(`[RouteVisualization] Cannot render route ${route.id}: Invalid waypoints and no valid detailed path available.`);
      const defaultPoint = calculateCartesianFromGeodetic(0, 0, elevation);
      return [defaultPoint, defaultPoint]; // Prevent errors
    }

    // Use waypoints if no valid detailed path
    return route.waypoints.map(([longitude, latitude]) =>
      calculateCartesianFromGeodetic(latitude, longitude, elevation)
    );
  }, [route.waypoints, route.detailedPath, route.id]); // Depend on waypoints and detailedPath

  console.log(`[RouteVisualization] Rendering route ID: ${route.id} using ${points.length >= 2 ? 'valid points' : 'default points'} from ${route.detailedPath && route.detailedPath.length >= 2 ? 'detailedPath' : 'waypoints'}.`);


  // Check if we have valid points to render
  if (points.length < 2) {
    return null; // Don't render if points are invalid
  }

  // Optionally adjust color based on whether it's a fetched route
  // Example: Use a different color if a detailed path was successfully used
  const actualColor = (route.detailedPath && route.detailedPath.length >= 2) ? '#FFA500' : color; // Orange for directed routes

  return (
    <>
      {/* Main route line */}
      <Line
        points={points}
        color={actualColor} // Use potentially adjusted color
        lineWidth={width}
        alphaToCoverage={true}
        transparent={true}
        opacity={opacity}
        dashed={dashed}
        depthTest={false}
      />

      {/* Glow effect */}
      <Line
        points={points}
        color={actualColor} // Use potentially adjusted color
        lineWidth={width * 2}
        alphaToCoverage={true}
        transparent={true}
        opacity={opacity * 0.3}
        depthTest={false}
      />

      {/* Markers for start and end points */}
      <mesh position={points[0]}>
        <sphereGeometry args={[60, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>

      <mesh position={points[points.length - 1]}>
        <sphereGeometry args={[60, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
    </>
  );
};

export default RouteVisualization;
