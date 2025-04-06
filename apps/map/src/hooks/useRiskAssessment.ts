import { useState, useEffect } from 'react';
import { Simulation } from '../services/SimulationService';
import { distance } from '@turf/turf'; // Using turf for distance calculation

export interface RiskPoint {
    lat: number;
    lng: number;
    weight: number;
}

interface RiskHotspot {
lat: number;
lng: number;
intensity: number;
}

interface RoutePoint {
lat?: number;
lng?: number;
latitude?: number;
longitude?: number;
}

// Define the structure for the points needed by the hook
interface AssessmentPoint {
    lat: number;
    lng: number;
}

interface UseRiskAssessmentResult {
    riskPoints: RiskPoint[];
    isLoading: boolean;
    error: Error | null;
}

/**
 * Custom hook to fetch risk assessment data for a given set of points or a simulation.
 * @param points An array of {lat, lng} points, or a Simulation object to extract points from.
 * @returns An object containing the fetched riskPoints, loading state, and error state.
 */
export const useRiskAssessment = (
    simulation: Simulation | null,
    detailedPaths?: Record<string, [number, number][]> // Optional detailed paths for more points
): UseRiskAssessmentResult => {
    const [riskPoints, setRiskPoints] = useState<RiskPoint[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        // Don't fetch if no simulation is provided
        if (!simulation || !simulation.actors || simulation.actors.length === 0) {
            setRiskPoints([]);
            setIsLoading(false);
            setError(null);
            return;
        }

        const extractPoints = (): AssessmentPoint[] => {
            const pointsForAssessment: AssessmentPoint[] = [];
            const pointSet = new Set<string>(); // Use set to avoid duplicates

            const addPoint = (lat: number | undefined, lng: number | undefined) => {
                if (lat != null && lng != null) {
                    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
                    if (!pointSet.has(key)) {
                        pointSet.add(key);
                        pointsForAssessment.push({ lat, lng });
                    }
                }
            };

            simulation.actors.forEach(actor => {
                // Assert actor type to access destinations
                const currentActor = actor as any;

                // Add destination points
                currentActor.destinations?.forEach((dest: any) => addPoint(dest.latitude, dest.longitude));

                // Add points from detailed paths if available and provided
                 if (detailedPaths && currentActor.destinations && currentActor.destinations.length >= 2) {
                    for (let i = 0; i < currentActor.destinations.length - 1; i++) {
                       const routeId = `${currentActor.id}-segment-${i}`;
                       const path = detailedPaths[routeId];
                       if (path && path.length > 0) {
                          // Sample points from the detailed path
                          const samplingRate = Math.max(1, Math.floor(path.length / 10));
                           for (let j = 0; j < path.length; j += samplingRate) {
                              const [lng, lat] = path[j];
                              addPoint(lat, lng);
                           }
                       }
                    }
                 }
            });
            return pointsForAssessment;
        };

        const pointsToAssess = extractPoints();

        if (pointsToAssess.length === 0) {
            console.log('[useRiskAssessment] No valid points found for assessment.');
            setRiskPoints([]);
            setIsLoading(false);
            setError(null);
            return;
        }

        const fetchRisk = async () => {
            setIsLoading(true);
            setError(null);
            console.log(`[useRiskAssessment] Fetching risk assessment for ${pointsToAssess.length} points.`);
            try {
                const data = await fetchRouteRiskAssessment(pointsToAssess);
                setRiskPoints(data);
                 console.log(`[useRiskAssessment] Received ${data.length} risk points.`);
            } catch (err) {
                console.error('[useRiskAssessment] Error fetching risk assessment:', err);
                setError(err instanceof Error ? err : new Error('Failed to fetch risk assessment'));
                setRiskPoints([]); // Clear points on error
            } finally {
                setIsLoading(false);
            }
        };

        fetchRisk();

        // Dependency: fetch when simulation changes. We assume detailedPaths is relatively stable
        // or managed such that it doesn't cause excessive refetches if included.
        // Including detailedPaths might be necessary if risk needs recalculation when paths update.
        // For now, let's fetch primarily based on the simulation changing.
    }, [simulation, detailedPaths]); // Re-fetch if simulation or detailedPaths change

    return { riskPoints, isLoading, error };
};

/**
 * Utility function to fetch risk assessment for a route
 * @param {RoutePoint[]} routePoints - Array of points representing the route
 * @returns {Promise<RiskPoint[]>} - Promise that resolves to an array of risk points
 */
export const fetchRouteRiskAssessment = async (routePoints: RoutePoint[] | number[][]): Promise<RiskPoint[]> => {
  try {
    console.log('[RiskHeatmap] Preparing to fetch risk assessment for', routePoints.length, 'points');
    
    // Ensure route points are in the correct format expected by the backend
    // The backend expects an array of objects with lat and lng properties
    const formattedRoutePoints = routePoints.map(point => {
      // If the point is already in the correct format, return it as is
      if (point && typeof point === 'object' && 'lat' in point && 'lng' in point) {
        return point as RoutePoint;
      }
      // If the point is an array [lat, lng], convert it to the expected format
      if (Array.isArray(point)) {
        return { lat: point[0], lng: point[1] };
      }
      // If the point has latitude/longitude properties, convert to lat/lng
      if (point && typeof point === 'object' && 'latitude' in point && 'longitude' in point) {
        return { lat: (point as RoutePoint).latitude, lng: (point as RoutePoint).longitude };
      }
      // Default case - return the point as is
      return point as RoutePoint;
    });

    // Use a relative URL path that doesn't depend on environment variables
    // THIS IS THE CORRECT URL FOR THE RISK ASSESSMENT API DO NOT CHANGE IT
    const apiUrl = `${import.meta.env['VITE_API_URL']}/api/risk-assessment/`;
    console.log(`[RiskHeatmap] Calling API at: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ routePoints: formattedRoutePoints }),
    });

    if (!response.ok) {
      console.error(`[RiskHeatmap] API returned error status: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('[RiskHeatmap] Risk assessment API call successful');
    const data = await response.json();
    console.log('[RiskHeatmap] Received risk data with', data.riskPoints?.length || 0, 'points');
    
    return data.riskPoints as RiskPoint[];
  } catch (error) {
    console.error('[RiskHeatmap] Error fetching risk assessment:', error);
    return [];
  }
};

/**
 * Generate risk points along a route using client-side calculations
 * This is a fallback when the backend API is not available
 * @param {google.maps.DirectionsRoute} route - Google Maps DirectionsRoute object
 * @returns {RiskPoint[]} - Array of risk points with lat, lng, and weight properties
 */
export const generateRouteRiskPoints = (route: google.maps.DirectionsRoute): RiskPoint[] => {
  if (!route || !route.legs) {
    return [];
  }

  const riskPoints: RiskPoint[] = [];
  
  // Risk hotspots - areas with higher risk levels
  const riskHotspots: RiskHotspot[] = [
    { lat: 36.1, lng: -115.2, intensity: 0.9 },  // Example hotspot 1
    { lat: 36.2, lng: -115.1, intensity: 0.8 },  // Example hotspot 2
    { lat: 36.0, lng: -115.3, intensity: 0.7 },  // Example hotspot 3
  ];

  // Process each leg of the route
  route.legs.forEach(leg => {
    if (!leg.steps) return;
    
    // Process each step of the leg
    leg.steps.forEach(step => {
      if (!step.path) return;
      
      // Sample points along the path (not every point to avoid excessive computation)
      const samplingRate = Math.max(1, Math.floor(step.path.length / 10));
      
      for (let i = 0; i < step.path.length; i += samplingRate) {
        const point = step.path[i];
        const lat = point.lat();
        const lng = point.lng();
        
        // Calculate base risk based on distance from risk hotspots
        let riskLevel = 0.2; // Base risk level
        
        // Add risk based on proximity to hotspots
        riskHotspots.forEach(hotspot => {
          const distance = Math.sqrt(
            Math.pow(lat - hotspot.lat, 2) + 
            Math.pow(lng - hotspot.lng, 2)
          );
          
          // Exponential decay of risk with distance
          const proximityRisk = hotspot.intensity * Math.exp(-distance * 20);
          riskLevel += proximityRisk;
        });
        
        // Normalize risk level to 0-1 range
        riskLevel = Math.min(1, Math.max(0, riskLevel));
        
        riskPoints.push({
          lat,
          lng,
          weight: riskLevel
        });
      }
    });
  });
  
  return riskPoints;
};

/**
 * Color gradient for risk visualization (Green to Red)
 */
export const RISK_GRADIENT = [
  [0, 255, 0, 255],    // Solid Green (low risk) index 0
  [255, 255, 0, 255], // Yellow index 1
  [255, 165, 0, 255], // Orange index 2
  [255, 0, 0, 255]    // Solid Red (high risk) index 3
];

/**
 * Interpolates a color from the RISK_GRADIENT based on a weight value (0 to 1).
 * Ensures alpha is always 255.
 * @param weight The risk weight (0 to 1).
 * @returns An RGBA color array [r, g, b, a].
 */
export const getColorFromGradient = (weight: number): [number, number, number, number] => {
  const clampedWeight = Math.min(1, Math.max(0, weight));
  const segmentCount = RISK_GRADIENT.length - 1; // 3 segments
  const segmentIndex = Math.floor(clampedWeight * segmentCount); // 0, 1, 2
  const segmentProgress = (clampedWeight * segmentCount) - segmentIndex;

  const startIndex = Math.min(segmentIndex, RISK_GRADIENT.length - 2); // Ensure start index is valid
  const endIndex = startIndex + 1; // End index is always start + 1

  const startColor = RISK_GRADIENT[startIndex];
  const endColor = RISK_GRADIENT[endIndex];

  const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * segmentProgress);
  const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * segmentProgress);
  const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * segmentProgress);

  // Ensure alpha is always 255 (fully opaque)
  return [r, g, b, 255];
};

/**
 * Finds the risk weight for a given point by checking the closest risk point.
 * @param lat Latitude of the point to check.
 * @param lng Longitude of the point to check.
 * @param riskPoints Array of available risk points.
 * @param maxDistance Maximum distance (in kilometers) to consider a risk point relevant.
 * @returns The weight of the closest risk point within maxDistance, or 0 if none found.
 */
export const getRiskWeightAtPoint = (
    lat: number,
    lng: number,
    riskPoints: RiskPoint[] | undefined,
    maxDistance: number = 1 // Max distance in km to associate risk
): number => {
    if (!riskPoints || riskPoints.length === 0) {
        return 0; // Default to zero risk if no points available
    }

    let closestRiskWeight = 0;
    let minDistance = Infinity;
    const checkPoint = [lng, lat];

    riskPoints.forEach(riskPoint => {
        const riskPointCoords = [riskPoint.lng, riskPoint.lat];
        const dist = distance(checkPoint, riskPointCoords, { units: 'kilometers' });

        if (dist < minDistance && dist <= maxDistance) {
            minDistance = dist;
            closestRiskWeight = riskPoint.weight;
        }
    });

    return closestRiskWeight;
};

