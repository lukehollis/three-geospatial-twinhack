import { Geodetic, radians } from '@takram/three-geospatial';
import * as THREE from 'three';

// Earth radius in meters (WGS84 equatorial radius)
const EARTH_RADIUS = 6378137;

/**
 * Convert geodetic coordinates (latitude, longitude) to cartesian coordinates
 * Using Geodetic from three-geospatial for accurate conversion
 */
export function calculateCartesianFromGeodetic(
  latitude: number,
  longitude: number,
  altitude: number = 0
): THREE.Vector3 {
  const geodetic = new Geodetic(radians(longitude), radians(latitude), altitude);
  const position = new THREE.Vector3();
  geodetic.toECEF(position);
  return position;
}

/**
 * Convert cartesian coordinates to geodetic coordinates
 * 
 * @param position - Cartesian position as THREE.Vector3
 * @returns Object with latitude and longitude in degrees
 */
export function calculateGeodeticFromCartesian(
  position: THREE.Vector3
): { latitude: number; longitude: number; altitude: number } {
  // Use ECEF coordinates directly
  const x = position.x;
  const y = position.y;
  const z = position.z;

  // Calculate longitude from atan2(y, x)
  // Longitude is the angle in the XY plane from the X axis
  const longitude = Math.atan2(y, x) * (180 / Math.PI);

  // Calculate distance from center of earth
  const distance = Math.sqrt(x * x + y * y + z * z);
  if (distance === 0) {
    // Handle case where position is exactly at the center
    return { latitude: 0, longitude: 0, altitude: -EARTH_RADIUS };
  }

  // Calculate latitude from asin(z / distance)
  // Latitude is the angle from the equatorial plane (XY plane)
  const latitude = Math.asin(z / distance) * (180 / Math.PI);

  // Calculate altitude
  const altitude = distance - EARTH_RADIUS;

  return { latitude, longitude, altitude };
}

/**
 * Calculate the great circle distance between two points on Earth
 */
export const calculateGreatCircleDistance = (
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
): number => {
  // Convert to radians
  const φ1 = radians(startLat);
  const φ2 = radians(endLat);
  const Δφ = radians(endLat - startLat);
  const Δλ = radians(endLng - startLng);

  // Use haversine formula for better accuracy
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
           Math.cos(φ1) * Math.cos(φ2) *
           Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return EARTH_RADIUS * c;
};

/**
 * Calculate heading between two points on Earth
 */
export const calculateHeading = (start: [number, number], end: [number, number]): number => {
  const [startLng, startLat] = start;
  const [endLng, endLat] = end;
  
  // Convert to radians
  const startLatRad = radians(startLat);
  const endLatRad = radians(endLat);
  const deltaLng = radians(endLng - startLng);
  
  // Calculate heading
  const y = Math.sin(deltaLng) * Math.cos(endLatRad);
  const x = Math.cos(startLatRad) * Math.sin(endLatRad) -
            Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(deltaLng);
  
  let heading = Math.atan2(y, x) * 180 / Math.PI;
  heading = (heading + 360) % 360;
  
  return heading;
};

/**
 * Calculate position along a route using great circle interpolation
 */
export const getPositionAlongRoute = (
  start: [number, number],
  end: [number, number],
  progress: number
): [number, number] => {
  // Convert to radians
  const [startLng, startLat] = start;
  const [endLng, endLat] = end;
  const φ1 = radians(startLat);
  const λ1 = radians(startLng);
  const φ2 = radians(endLat);
  const λ2 = radians(endLng);

  // Calculate using spherical interpolation
  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((φ2 - φ1) / 2), 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.pow(Math.sin((λ2 - λ1) / 2), 2)
  ));

  const A = Math.sin((1 - progress) * d) / Math.sin(d);
  const B = Math.sin(progress * d) / Math.sin(d);

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);

  const φ3 = Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));
  const λ3 = Math.atan2(y, x);

  // Convert back to degrees
  return [λ3 * 180 / Math.PI, φ3 * 180 / Math.PI];
};
