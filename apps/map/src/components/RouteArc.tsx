import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { Route } from '../services/SimulationService';
import * as THREE from 'three';
import { calculateCartesianFromGeodetic, calculateGreatCircleDistance } from '../utils/geospatial';

/****
 * 
 * Example Usage:
  <RouteArc 
    route={{
      id: 'your-route',
      name: 'Shanghai to San Francisco',
      origin: {
        name: 'Shanghai',
        coordinates: [121.4737, 31.2304] // [longitude, latitude]
      },
      destination: {
        name: 'San Francisco',
        coordinates: [-122.4194, 37.7749] // [longitude, latitude]
      },
      waypoints: [[121.4737, 31.2304], [-122.4194, 37.7749]]
    }}
    lineWidth={1}
  />
 */

// Make TypeScript happy with the Line component props
interface LineProps {
  points: THREE.Vector3[];
  color?: string;
  lineWidth?: number;
  transparent?: boolean;
  opacity?: number;
}

interface RouteArcProps {
  route: Route;
  color?: string;
  lineWidth?: number;
  arcHeight?: number;
}

const RouteArc: React.FC<RouteArcProps> = ({ 
  route, 
  color = '#ffffff', 
  lineWidth = 1,
  arcHeight = 100000 // Height of the arc in meters - reduced to be closer to Earth surface
}) => {
  // Generate arc points between origin and destination
  const arcPoints = useMemo(() => {
    if (!route || !route.origin || !route.destination) {
      console.error('RouteArc: Missing route data', route);
      return [];
    }

    console.log('RENDERING ROUTE ARC - USING GEODETIC CONVERSION');
    console.log(`Route ID: ${route.id}`);
    console.log(`From ${route.origin.name} to ${route.destination.name}`);
    
    // Get coordinates
    const origin = route.origin.coordinates;
    const destination = route.destination.coordinates;
    
    console.log(`Origin: [${origin[0]}, ${origin[1]}]`);
    console.log(`Destination: [${destination[0]}, ${destination[1]}]`);
    
    // Convert coordinates using the shared utility
    const originCartesian = calculateCartesianFromGeodetic(origin[1], origin[0], 0);
    const destCartesian = calculateCartesianFromGeodetic(destination[1], destination[0], 0);
    
    console.log(`Origin cartesian: (${originCartesian.x}, ${originCartesian.y}, ${originCartesian.z})`);
    console.log(`Destination cartesian: (${destCartesian.x}, ${destCartesian.y}, ${destCartesian.z})`);
    
    // Create a proper curved arc with multiple points
    const points = [];
    const segments = 20; // More segments for a smoother curve
    
    // Calculate the great circle distance between the points
    const greatCircleDistance = calculateGreatCircleDistance(
      origin[0], origin[1],
      destination[0], destination[1]
    );
    
    console.log(`Great circle distance: ${greatCircleDistance / 1000} km`);
    
    // Dynamically adjust arc height based on distance
    // For very long routes, we don't want the arc to go too high
    const dynamicArcHeight = Math.min(
      arcHeight, // Use provided arcHeight as maximum
      greatCircleDistance * 0.05 // 5% of the great circle distance
    );
    
    console.log(`Using dynamic arc height: ${dynamicArcHeight} meters`);
    
    // Start with the exact origin point at Earth's surface
    points.push(originCartesian.clone());
    
    // Create intermediate points along the great circle with height
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      
      // Spherical linear interpolation (SLERP) between the two points
      // This creates points along the great circle path
      const slerpPoint = new THREE.Vector3();
      slerpPoint.copy(originCartesian.clone().normalize());
      slerpPoint.lerp(destCartesian.clone().normalize(), t).normalize();
      
      // Calculate height at this point (parabolic arc)
      // Maximum height at the middle (t=0.5), zero at the ends (t=0 or t=1)
      let heightFactor = 4 * t * (1 - t); // Parabolic function that peaks at t=0.5
      
      // For points near the ends, gradually reduce height for smoother transition
      if (i === 1 || i === segments - 1) {
        // Reduce height for points adjacent to endpoints
        heightFactor *= 0.3;
      }
      
      const pointHeight = 6378137 + (dynamicArcHeight * heightFactor); // Earth radius + arc height
      
      // Scale the point to the correct height
      const finalPoint = slerpPoint.clone().multiplyScalar(pointHeight);
      points.push(finalPoint);
    }
    
    // End with the exact destination point at Earth's surface
    points.push(destCartesian.clone());
    
    console.log(`Created curved arc with ${points.length} points`);
    console.log(`Maximum arc height: ${arcHeight} meters above Earth surface`);
    
    return points;
  }, [route, arcHeight]);

  if (arcPoints.length === 0) {
    console.error('RouteArc: No arc points generated for route', route.id);
    return null;
  }
  
  return (
    <>
      {/* Main line - unlit */}
      <Line
        points={arcPoints}
        color={color}
        lineWidth={lineWidth}
        transparent={false}
        opacity={1.0}
        vertexColors={false}
        toneMapped={false}  // Prevents tone mapping
        fog={false}        // Not affected by scene fog
        lights={false}     // Not affected by scene lights
        dashed={false}
      />
      
      {/* Glow effect - also unlit */}
      <Line
        points={arcPoints}
        color="#FFFFFF" 
        lineWidth={lineWidth * 1.1} 
        transparent={true}
        opacity={0.3}
        vertexColors={false}
        toneMapped={false}  // Prevents tone mapping
        fog={false}        // Not affected by scene fog
        lights={false}     // Not affected by scene lights
        dashed={false}
      />
    </>
  );
};

export default RouteArc;
