import React, { useEffect, useRef } from 'react';

interface RiskPoint {
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

class RiskHeatmapOverlay {
  private map: google.maps.Map;
  private heatmap: google.maps.visualization.HeatmapLayer | null;
  private riskPoints: RiskPoint[];
  private retryCount: number;
  private maxRetries: number;

  constructor(map: google.maps.Map) {
    console.log('[RiskHeatmapOverlay] Initializing overlay with map', !!map);
    this.map = map;
    this.heatmap = null;
    this.riskPoints = [];
    this.retryCount = 0;
    this.maxRetries = 5;
    
    // Check if visualization library is available
    if (!window.google?.maps?.visualization) {
      console.warn('[RiskHeatmapOverlay] Visualization library not available during initialization, will retry');
      // Schedule check for visualization library
      this.checkVisualizationLibrary();
    }
  }

  /**
   * Check if visualization library is available and retry if not
   */
  private checkVisualizationLibrary(): void {
    if (this.retryCount >= this.maxRetries) {
      console.error('[RiskHeatmapOverlay] Max retries reached, visualization library not available');
      return;
    }

    if (window.google?.maps?.visualization) {
      console.log('[RiskHeatmapOverlay] Visualization library now available');
      // If we have data, update the heatmap
      if (this.riskPoints.length > 0) {
        this.updateHeatmap();
      }
      return;
    }

    this.retryCount++;
    console.log(`[RiskHeatmapOverlay] Visualization library not available, retry ${this.retryCount}/${this.maxRetries}`);
    setTimeout(() => this.checkVisualizationLibrary(), 1000); // Check again in 1 second
  }

  /**
   * Set the risk data points for the heatmap
   * @param {RiskPoint[]} riskPoints - Array of objects with lat, lng, and weight properties
   */
  setRiskData(riskPoints: RiskPoint[]): void {
    console.log('[RiskHeatmapOverlay] Setting risk data with', riskPoints.length, 'points');
    this.riskPoints = riskPoints;
    this.updateHeatmap();
  }

  /**
   * Update the heatmap with the current risk data
   */
  updateHeatmap(): void {
    // Remove existing heatmap if it exists
    if (this.heatmap) {
      console.log('[RiskHeatmapOverlay] Removing existing heatmap layer');
      this.heatmap.setMap(null);
      this.heatmap = null;
    }

    // If no risk points, don't create a heatmap
    if (!this.riskPoints || this.riskPoints.length === 0) {
      console.log('[RiskHeatmapOverlay] No risk points to display, skipping heatmap creation');
      return;
    }

    console.log('[RiskHeatmapOverlay] Creating heatmap with', this.riskPoints.length, 'points');
    
    try {
      // Check if visualization library is loaded
      if (!window.google || !window.google.maps || !window.google.maps.visualization) {
        console.error('[RiskHeatmapOverlay] Google Maps visualization library not loaded, will retry');
        this.checkVisualizationLibrary(); // Start the retry process
        return;
      }
      
      // Convert risk points to Google Maps LatLng objects with weights
      const heatmapData = this.riskPoints.map(point => {
        return {
          location: new window.google.maps.LatLng(point.lat, point.lng),
          weight: point.weight
        };
      });

      // Create the heatmap layer
      this.heatmap = new window.google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map: this.map,
        radius: 20,
        opacity: 0.7,
        gradient: [
          'rgba(0, 255, 0, 0)',    // Green (low risk)
          'rgba(0, 255, 0, 1)',    // Green
          'rgba(255, 255, 0, 1)',  // Yellow
          'rgba(255, 165, 0, 1)',  // Orange
          'rgba(255, 0, 0, 1)'     // Red (high risk)
        ]
      });
      
      console.log('[RiskHeatmapOverlay] Heatmap created and added to map');
    } catch (error) {
      console.error('[RiskHeatmapOverlay] Error creating heatmap:', error);
    }
  }

  /**
   * Clear the heatmap from the map
   */
  clear(): void {
    console.log('[RiskHeatmapOverlay] Clearing heatmap');
    if (this.heatmap) {
      this.heatmap.setMap(null);
      this.heatmap = null;
    }
    this.riskPoints = [];
  }

  /**
   * Set the visibility of the heatmap
   * @param {boolean} visible - Whether the heatmap should be visible
   */
  setVisible(visible: boolean): void {
    console.log('[RiskHeatmapOverlay] Setting heatmap visibility:', visible, 'heatmap exists:', !!this.heatmap);
    if (this.heatmap) {
      this.heatmap.setMap(visible ? this.map : null);
    } else if (visible && this.riskPoints.length > 0) {
      // If heatmap doesn't exist but should be visible and we have data, recreate it
      console.log('[RiskHeatmapOverlay] Recreating heatmap to make it visible');
      this.updateHeatmap();
    }
  }
}

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

export default RiskHeatmapOverlay;
