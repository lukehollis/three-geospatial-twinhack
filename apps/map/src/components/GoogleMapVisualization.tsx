import React, { useEffect, useRef, useState } from 'react';
import { googleMapsLoadedAtom } from './GoogleMapLoader';
import { useAtomValue } from 'jotai';
import { Simulation, Actor, PlaybackState } from '../services/SimulationService';
import { getPositionAlongRoute } from '../utils/geospatialUtils';
import { actorPaths } from '../utils/actors';
import RiskHeatmapOverlay, { fetchRouteRiskAssessment, generateRouteRiskPoints } from './RiskOverlayHeatmap';

interface GoogleMapVisualizationProps {
  map: google.maps.Map | null;
  simulation: Simulation | null;
  playbackState: PlaybackState;
  onBoundsCalculated?: (bounds: google.maps.LatLngBounds) => void;
  onPause?: () => void;
  onPlay?: () => void;
  onStop?: () => void;
}

// Track position for each actor during animation
interface ActorAnimationState2D {
  position: [number, number]; // [lng, lat]
  progress: number;
  currentDestIndex: number;
}

// Route interface for internal use
interface Route {
  id: string;
  name: string;
  origin: {
    name: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  destination: {
    name: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  waypoints?: [number, number][]; // Array of [longitude, latitude] coordinates
}

// Add to your interfaces
interface RouteData {
  path: google.maps.LatLng[];  // Stores the complete path points
  distance: number;            // Total distance of the route
}

const GoogleMapVisualization: React.FC<GoogleMapVisualizationProps> = ({
  map,
  simulation,
  playbackState,
  onBoundsCalculated,
  onPause,
  onPlay,
  onStop
}) => {
  // SHARED REFS AND STATE
  const isApiLoaded = useAtomValue(googleMapsLoadedAtom);
  
  // MARKER REFS AND STATE
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [actorStates, setActorStates] = useState<Record<string, ActorAnimationState2D>>({});
  
  // ROUTE REFS AND STATE
  const polylineRef = useRef<Map<string, google.maps.Polyline>>(new Map());
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<Map<string, google.maps.DirectionsRenderer>>(new Map());
  const processedRouteIds = useRef(new Set<string>());
  const boundsRef = useRef<google.maps.LatLngBounds | null>(null);
  const routePathsRef = useRef<Map<string, RouteData>>(new Map());

  // Add a ref to track if we're coming from a reset
  const justResetRef = useRef<boolean>(false);

  // Add a flag to prevent rapid pause/play cycles
  const completionCooldownRef = useRef<boolean>(false);

  // Add a ref to track if we're coming from a paused state
  const wasPausedRef = useRef<boolean>(false);

  // Add risk heatmap ref
  const riskHeatmapRef = useRef<RiskHeatmapOverlay | null>(null);
  const [showRiskHeatmap, setShowRiskHeatmap] = useState<boolean>(true);

  // Initialize actor states when simulation changes
  useEffect(() => {
    if (!simulation || !simulation.actors) return;
    
    // Initialize animation state for each actor
    const newStates: Record<string, ActorAnimationState2D> = {};
    
    simulation.actors.forEach(actor => {
      if (actor.destinations.length > 0) {
        const firstDest = actor.destinations[0];
        newStates[actor.id] = {
          position: [firstDest.longitude, firstDest.latitude],
          progress: 0,
          currentDestIndex: 0
        };
      }
    });
    
    setActorStates(newStates);
  }, [simulation]);

  // Modify the reset useEffect to properly reset actorStates
  useEffect(() => {
    // Only reset actor positions when this is an explicit reset (stop button)
    if (playbackState.elapsedTime === 0 && playbackState.isReset === true) {
      console.log('[GoogleMapVisualization] Explicit reset detected - resetting actor positions');
      
      if (!simulation || !simulation.actors) return;
      
      // Reset all actors to their initial positions
      const newStates: Record<string, ActorAnimationState2D> = {};
      
      simulation.actors.forEach(actor => {
        if (actor.destinations.length > 0) {
          const firstDest = actor.destinations[0];
          newStates[actor.id] = {
            position: [firstDest.longitude, firstDest.latitude],
            progress: 0,
            currentDestIndex: 0
          };
          
          // Also update marker position immediately
          const marker = markersRef.current.get(actor.id);
          if (marker) {
            marker.setPosition({ 
              lat: firstDest.latitude, 
              lng: firstDest.longitude 
            });
          }
        }
      });
      
      // Update actor states and track that we did a reset
      setActorStates(newStates);
      justResetRef.current = true;
      
      // Make sure routes are visible
      ensureRoutesVisible();
    }
  }, [playbackState, simulation, map]);

  // Initialize markers when the map is ready and actors change
  useEffect(() => {
    if (!map || !simulation || !simulation.actors) return;
    
    console.log('[GoogleMapVisualization] Initializing markers for', simulation.actors.length, 'actors');

    // Initialize info window if not already created
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    // Create or update markers for each actor
    simulation.actors.forEach((actor) => {
      const actorState = actorStates[actor.id];
      if (!actorState) return; // Skip if no animation state exists
      
      const [lng, lat] = actorState.position;
      const position = { lat, lng };

      // Get existing marker or create a new one
      let marker = markersRef.current.get(actor.id);

      if (!marker) {
        // Create new marker
        marker = new google.maps.Marker({
          position,
          map,
          title: actor.name,
          icon: getActorIcon(actor)
        });

        // Add click listener for info window
        marker.addListener('click', () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(createInfoWindowContent(actor, actorState));
            infoWindowRef.current.open(map, marker);
          }
        });

        // Store marker reference
        markersRef.current.set(actor.id, marker);
      } else {
        // Update existing marker
        marker.setPosition(position);
        marker.setTitle(actor.name);
        marker.setIcon(getActorIcon(actor));
      }
    });

    // Remove markers for actors that no longer exist
    const currentActorIds = new Set(simulation.actors.map(v => v.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentActorIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Clean up on unmount ONLY the markers, NOT the routes
    return () => {
      markersRef.current.forEach(marker => {
        marker.setMap(null);
      });
      markersRef.current.clear();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Do NOT clear routes here
    };
  }, [map, simulation, actorStates]);

  // Initialize directions service when map is ready
  useEffect(() => {
    if (!map) return;
    if (directionsServiceRef.current) return;
    
    directionsServiceRef.current = new google.maps.DirectionsService();
  }, [map]);

  // Modify the animation useEffect to handle post-reset play correctly
  useEffect(() => {
    console.log('[GoogleMapVisualization] Animation useEffect', {
      isPlaying: playbackState.isPlaying,
      isPaused: playbackState.isPaused,
      isReset: playbackState.isReset,
      justReset: justResetRef.current,
      actorCount: simulation?.actors?.length || 0,
      speedMultiplier: playbackState.speedMultiplier
    });

    if (!map || !simulation || !playbackState.isPlaying || playbackState.isPaused) {
      console.log('[GoogleMapVisualization] Animation stopped due to conditions');
      
      // If we're stopping due to pause, set the paused flag
      if (playbackState.isPaused) {
        wasPausedRef.current = true;
      }
      
      return;
    }

    // If we're starting to play right after a reset, ensure we start from the beginning
    if (justResetRef.current && playbackState.isPlaying) {
      console.log('[GoogleMapVisualization] Starting animation from reset state');
      
      // Reset animation time tracking
      lastTimeRef.current = 0;
      
      // Reset the flag so we don't do this again until next reset
      justResetRef.current = false;
      
      // Reset actor states one more time to be absolutely sure
      if (simulation.actors) {
        const freshStates: Record<string, ActorAnimationState2D> = {};
        
        simulation.actors.forEach(actor => {
          if (actor.destinations && actor.destinations.length > 0) {
            const firstDest = actor.destinations[0];
            freshStates[actor.id] = {
              position: [firstDest.longitude, firstDest.latitude],
              progress: 0,
              currentDestIndex: 0
            };
          }
        });
        
        // Set these fresh states
        setActorStates(freshStates);
      }
    }

    // If we're coming back from pause, reset the time reference
    if (wasPausedRef.current && playbackState.isPlaying) {
      console.log('[GoogleMapVisualization] Resuming from pause - resetting time delta');
      lastTimeRef.current = 0;
      wasPausedRef.current = false;
    }

    // Store the current directions renderers and polylines when animation starts
    // to ensure they aren't accidentally cleared
    const currentDirectionsRenderers = new Map(directionsRendererRef.current);
    const currentPolylines = new Map(polylineRef.current);

    const animate = (time: number) => {
      // If this is the first frame after resuming, don't calculate a large delta
      const deltaTime = lastTimeRef.current ? 
        (lastTimeRef.current === 0 ? 16 : time - lastTimeRef.current) : 16; // Use 16ms (~60fps) as default delta
      
      lastTimeRef.current = time;

      // Clone current state to make updates
      const newActorStates = { ...actorStates };
      let statesChanged = false;
      
      // Track if all actors have reached their destinations
      let allActorsCompleted = true;

      // Update each actor's position based on progress
      simulation.actors.forEach(actor => {
        const marker = markersRef.current.get(actor.id);
        if (!marker) return;
        
        // Skip actors with fewer than 2 destinations
        if (!actor.destinations || actor.destinations.length < 2) return;
        
        const actorState = newActorStates[actor.id];
        if (!actorState) return;
        
        // Calculate actual percentage of the whole route completed
        const totalRouteDistance = calculateTotalRouteDistance(actor);
        const distanceTraveled = calculateDistanceTraveled(actor, actorState.currentDestIndex, actorState.progress);
        const actualRouteCompletion = totalRouteDistance > 0 ? distanceTraveled / totalRouteDistance : 0;
        
        // Check if this actor has reached its final destination (using actual distance)
        const isAtFinalDestination = actualRouteCompletion >= 0.999; // 99.9% complete
        
        if (actualRouteCompletion > 0.95) {
          console.log(`[GoogleMapVisualization] Actor ${actor.name} route completion:`, {
            actualCompletion: actualRouteCompletion,
            distanceTraveled: distanceTraveled,
            totalDistance: totalRouteDistance,
            destIndex: actorState.currentDestIndex,
            totalDests: actor.destinations.length,
            isAtFinal: isAtFinalDestination
          });
        }
        
        // Now use the accurate route completion for determining if animation is complete
        if (!isAtFinalDestination) {
          allActorsCompleted = false;
        }
        
        // If we've reached the end of all destinations, keep marker at final position but don't update progress
        if (isAtFinalDestination) {
          // Ensure the marker stays at the final destination
          const finalDest = actor.destinations[actor.destinations.length - 1].destination;
          const finalPos = { lat: finalDest.latitude, lng: finalDest.longitude };
          
          // Only update if needed
          if (marker.getPosition()?.lat() !== finalPos.lat || marker.getPosition()?.lng() !== finalPos.lng) {
            marker.setPosition(finalPos);
            newActorStates[actor.id] = {
              position: [finalPos.lng, finalPos.lat],
              progress: 1.0,
              currentDestIndex: actor.destinations.length - 1
            };
            statesChanged = true;
          }
          return; // Skip further movement for completed actors
        }
        
        // Calculate new progress for actors still in motion
        let newProgress = actorState.progress + (deltaTime * 0.0002 * playbackState.speedMultiplier);
        let currentDestIndex = actorState.currentDestIndex;
        
        // If we've reached the next destination, move to the next segment
        if (newProgress >= 1.0 && currentDestIndex < actor.destinations.length - 1) {
          currentDestIndex++;
          newProgress = 0;
        }
        
        // Cap progress at 1.0
        newProgress = Math.min(1.0, newProgress);
        
        // Get source and target destinations
        const sourceDest = actor.destinations[currentDestIndex];
        const targetDest = actor.destinations[Math.min(currentDestIndex + 1, actor.destinations.length - 1)];
        
        // Compute the current route ID
        const routeId = `${actor.id}-route-${currentDestIndex}`;
        const routeData = routePathsRef.current.get(routeId);
        
        // If we have a path for this route segment, use it
        if (routeData && routeData.path.length > 1) {
          // Use progress to find the right point on the path
          const progress = Math.min(1.0, actorState.progress);
          const pathPosition = getPositionOnPath(routeData.path, progress);
          
          // Update marker position
          marker.setPosition(pathPosition);
          
          // Update actor state
          newActorStates[actor.id] = {
            position: [pathPosition.lng(), pathPosition.lat()],
            progress: newProgress,
            currentDestIndex: currentDestIndex
          };
          
          statesChanged = true;
        } else {
          // Fallback to direct interpolation for routes without path data
          // Calculate new position along the route segment
          const sourceCoords: [number, number] = [sourceDest.longitude, sourceDest.latitude];
          const targetCoords: [number, number] = [targetDest.longitude, targetDest.latitude];
          
          const newPosition = getPositionAlongRoute(sourceCoords, targetCoords, newProgress);
          const [lng, lat] = newPosition;
          
          // Update marker position
          marker.setPosition({ lat, lng });
          
          newActorStates[actor.id] = {
            position: newPosition,
            progress: newProgress,
            currentDestIndex: currentDestIndex
          };
          
          statesChanged = true;
        }
      });
      
      // Update states if changed
      if (statesChanged) {
        setActorStates(newActorStates);
      }
      
      // Make sure routes are still visible - restore if needed
      directionsRendererRef.current.forEach((renderer, id) => {
        if (renderer.getMap() !== map) {
          renderer.setMap(map);
        }
      });
      
      polylineRef.current.forEach((polyline, id) => {
        if (polyline.getMap() !== map) {
          polyline.setMap(map);
        }
      });
      
      // If all actors have reached their destinations, pause the simulation
      if (allActorsCompleted && !completionCooldownRef.current) {
        console.log('[GoogleMapVisualization] All actors reached destinations - pausing simulation');
        
        // Set cooldown flag to prevent rapid cycles
        completionCooldownRef.current = true;
        
        // Ensure all markers are positioned at their final destinations
        simulation.actors.forEach(actor => {
          if (!actor.destinations || actor.destinations.length < 1) return;
          
          // Get the final destination
          const finalDest = actor.destinations[actor.destinations.length - 1].destination;
          const finalPos = { lat: finalDest.latitude, lng: finalDest.longitude };
          
          // Get the marker and ensure it's at the final position and visible
          const marker = markersRef.current.get(actor.id);
          if (marker) {
            // Set position and make sure it's visible on the map
            marker.setPosition(finalPos);
            marker.setMap(map);
            
            // Update actor state
            newActorStates[actor.id] = {
              position: [finalPos.lng, finalPos.lat],
              progress: 1.0,
              currentDestIndex: actor.destinations.length - 1
            };
          }
        });
        
        // Apply the final state updates before calling pause
        setActorStates(newActorStates);
        
        // Use setTimeout to ensure state updates have time to apply
        setTimeout(() => {
          // Then pause
          if (onPause) onPause();
          
          // Reset cooldown after a delay
          setTimeout(() => {
            completionCooldownRef.current = false;
          }, 1000);
        }, 50);
        
        return; // Don't request another animation frame
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    console.log('[GoogleMapVisualization] Starting animation loop');
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        console.log('[GoogleMapVisualization] Cleaning up animation frame');
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Do NOT clear routes here
    };
  }, [map, simulation, playbackState, actorStates]);

  // Generate routes from simulation data
  const generateRoutes = (simulation: Simulation | null): Route[] => {
    if (!simulation || !simulation.actors) return [];
    
    const routes: Route[] = [];
    
    simulation.actors.forEach((actor, actorIndex) => {
      if (!actor.destinations || actor.destinations.length < 2) return;
      
      // Create a route for each sequential pair of destinations
      for (let i = 0; i < actor.destinations.length - 1; i++) {
        const origin = actor.destinations[i];
        const destination = actor.destinations[i + 1];
        
        if (!origin || !destination) continue;
        
        const routeId = `${actor.id}-route-${i}`;
        const routeName = `${actor.name} route ${i+1}`;
        
        routes.push({
          id: routeId,
          name: routeName,
          origin: {
            name: origin.name,
            coordinates: [origin.longitude, origin.latitude]
          },
          destination: {
            name: destination.name,
            coordinates: [destination.longitude, destination.latitude]
          }
        });
      }
    });
    
    return routes;
  };

  // Create or update routes when simulation changes
  useEffect(() => {
    const effectStartTimestamp = performance.now();
    
    if (!map || !directionsServiceRef.current || !isApiLoaded) {
      console.log('[GoogleMapVisualization] Aborting route effect: Map, DirectionsService or API not ready.');
      return;
    }

    // --- Initialization ---
    const directionsService = directionsServiceRef.current;
    const routes = generateRoutes(simulation);
    const activeRouteIds = new Set(routes.map(r => r.id));
    let routesCreated = 0;
    let routesSkipped = 0;
    
    // Reset bounds for this run
    if (boundsRef.current === null) {
      boundsRef.current = new google.maps.LatLngBounds();
      processedRouteIds.current.clear();
      console.log('[GoogleMapVisualization] Initialized new LatLngBounds.');
    }
    
    let boundsWereExtended = false;
    let asyncOperationsPending = 0;

    // --- Helper Functions ---
    
    // Function to get travel mode based on actor type
    const getTravelMode = (actorType?: string): google.maps.TravelMode => {
      switch (actorType) {
        case 'train': return google.maps.TravelMode.TRANSIT;
        case 'truck':
        case 'car':
        default: return google.maps.TravelMode.DRIVING;
      }
    };

    // Function to create a direct polyline between origin and destination
    const createPolyline = (route: Route, actorType?: string) => {
      const routeId = route.id;
      console.log(`[GoogleMapVisualization] Processing route ${routeId}`);
      
      // Ensure no directions renderer exists for this route
      const existingRenderer = directionsRendererRef.current.get(routeId);
      if (existingRenderer) {
        console.log(`[GoogleMapVisualization] Removing existing directions renderer for route ${routeId} before creating polyline.`);
        existingRenderer.setMap(null);
        directionsRendererRef.current.delete(routeId);
      }

      // Create path
      let path;
      if (route.waypoints && route.waypoints.length > 0) {
        path = route.waypoints
          .filter(wp => wp?.[1] !== undefined && wp?.[0] !== undefined)
          .map(wp => ({ lat: wp[1], lng: wp[0] }));
      } else {
        path = [
          { lat: route.origin.coordinates[1], lng: route.origin.coordinates[0] },
          { lat: route.destination.coordinates[1], lng: route.destination.coordinates[0] }
        ];
      }
      
      if (path.length < 2) {
        console.error(`[GoogleMapVisualization] Cannot create polyline for route ${routeId}: requires at least 2 valid points, got ${path.length}.`);
        return;
      }

      // Create new polyline
      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#FFFFFF', // White for all routes
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map,
        zIndex: 1
      });
      
      polylineRef.current.set(routeId, polyline);
      console.log(`[GoogleMapVisualization] Created direct polyline for route ${routeId} with ${path.length} points.`);
      
      // Extend bounds with polyline path
      if (!processedRouteIds.current.has(routeId) && boundsRef.current) {
        polyline.getPath().forEach((latLng: google.maps.LatLng) => boundsRef.current!.extend(latLng));
        boundsWereExtended = true;
        processedRouteIds.current.add(routeId);
        console.log(`[GoogleMapVisualization] Extended bounds for route ${routeId}.`);
      }
    };

    // Function to request directions from Google Maps API
    const requestDirections = (route: Route, actorType: string | undefined, callback: () => void) => {
      const routeId = route.id;
      const travelMode = getTravelMode(actorType);
      const origin = new google.maps.LatLng(route.origin.coordinates[1], route.origin.coordinates[0]);
      const destination = new google.maps.LatLng(route.destination.coordinates[1], route.destination.coordinates[0]);

      const waypoints: google.maps.DirectionsWaypoint[] = [];
      if (route.waypoints && route.waypoints.length > 2) {
        for (let i = 1; i < route.waypoints.length - 1; i++) {
          if(route.waypoints[i]?.[1] !== undefined && route.waypoints[i]?.[0] !== undefined) {
            waypoints.push({ location: new google.maps.LatLng(route.waypoints[i][1], route.waypoints[i][0]), stopover: false });
          } else {
            console.warn(`[GoogleMapVisualization] Invalid waypoint data for route ${routeId} at index ${i}:`, route.waypoints[i]);
          }
        }
      }
      
      directionsServiceRef.current?.route({
        origin,
        destination,
        waypoints,
        travelMode,
        optimizeWaypoints: waypoints.length > 0
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          // Check if the route still exists
          if (!activeRouteIds.has(routeId)) {
            return;
          }
          // Check if a polyline was created in the meantime
          if (polylineRef.current.has(routeId)) {
            return;
          }
          
          // Create a new directions renderer
          const renderer = new google.maps.DirectionsRenderer({
            map,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: '#FFFFFF', // White for all routes
              strokeOpacity: 0.8,
              strokeWeight: 3,
              zIndex: 1
            }
          });
          renderer.setDirections(result);
          directionsRendererRef.current.set(routeId, renderer);
          
          // Extend bounds with the route path
          if (!processedRouteIds.current.has(routeId) && boundsRef.current) {
            result.routes[0].overview_path.forEach(point => boundsRef.current!.extend(point));
            boundsWereExtended = true;
            processedRouteIds.current.add(routeId);
          }

          // Store the complete path for animation
          const path = result.routes[0].overview_path;
          let totalDistance = 0;
          
          // Calculate the total distance of the path
          for (let i = 0; i < path.length - 1; i++) {
            totalDistance += google.maps.geometry.spherical.computeDistanceBetween(path[i], path[i+1]);
          }
          
          // Store the route data
          routePathsRef.current.set(routeId, {
            path,
            distance: totalDistance
          });
        } else {
          console.warn(`[GoogleMapVisualization] Directions failed for route ${routeId}: ${status}. Falling back to direct polyline.`);
          // Fallback
          if (activeRouteIds.has(routeId) && !polylineRef.current.has(routeId) && !directionsRendererRef.current.has(routeId)) {
            createPolyline(route, actorType);
          }
        }
        callback(); // Always call callback
      });
    };

    // Function to check if all operations are done and fit bounds
    const checkAndFitBounds = () => {
      if (asyncOperationsPending === 0 && (routesCreated + routesSkipped === routes.length)) {
        if (boundsWereExtended && onBoundsCalculated && boundsRef.current) {
          onBoundsCalculated(boundsRef.current);
          boundsRef.current = null; // Reset bounds ref after fitting
          processedRouteIds.current.clear(); // Reset processed IDs
        }
      }
    };

    // --- Create/Update Routes --- 
    routes.forEach(route => {
      const routeId = route.id;
      
      // If a polyline OR renderer already exists for this route, skip creation
      if (polylineRef.current.has(routeId) || directionsRendererRef.current.has(routeId)) {
        routesSkipped++;
        return;
      }

      routesCreated++;
      
      // Verify route has valid coordinates
      if (!route.origin?.coordinates || !route.destination?.coordinates) {
        console.error(`[GoogleMapVisualization] Route ${routeId} has invalid origin/destination coordinates:`, route);
        return;
      }
      
      // Find the actor type from routeId (format: actorId-route-index)
      const actorId = routeId.split('-route-')[0];
      const actor = simulation?.actors.find(a => a.id === actorId);
      const actorType = actor?.type || 'car';

      // Determine routing method
      if (route.origin && route.destination) {
        // Increment pending operations counter
        asyncOperationsPending++;
        requestDirections(route, actorType, () => {
          // Decrement counter when complete
          asyncOperationsPending--;
          checkAndFitBounds();
        });
      } else {
        console.warn(`[GoogleMapVisualization] Route ${routeId}: Cannot render - missing origin/destination.`);
      }
    });

    // Initial check in case there were no async operations
    checkAndFitBounds();

    // IMPORTANT CHANGE: Remove the cleanup function that's removing the routes
    // We don't want to clean up routes when playbackState changes
    // return () => {
    //   directionsRendererRef.current.forEach(renderer => renderer.setMap(null));
    //   polylineRef.current.forEach(polyline => polyline.setMap(null));
    // };
    
    // Instead, only clean up routes when the component unmounts
    return () => {
      // This cleanup should only run when component unmounts
      if (!map) {
        directionsRendererRef.current.forEach(renderer => renderer.setMap(null));
        polylineRef.current.forEach(polyline => polyline.setMap(null));
      }
    };
    
  }, [map, simulation, isApiLoaded, onBoundsCalculated]);

  // Initialize risk heatmap when map is ready - MOVED UP in effect order
  useEffect(() => {
    if (!map) return;
    
    console.log('[GoogleMapVisualization] Initializing risk heatmap overlay');
    // Always create a new heatmap when map changes to ensure clean state
    if (riskHeatmapRef.current) {
      console.log('[GoogleMapVisualization] Clearing existing risk heatmap');
      riskHeatmapRef.current.clear();
    }
    
    riskHeatmapRef.current = new RiskHeatmapOverlay(map);
    console.log('[GoogleMapVisualization] Risk heatmap initialized');
    
    return () => {
      if (riskHeatmapRef.current) {
        console.log('[GoogleMapVisualization] Cleaning up risk heatmap on map change');
        riskHeatmapRef.current.clear();
      }
    };
  }, [map]);

  // Extract route points from all routes
  const extractRoutePoints = () => {
    if (!simulation?.actors) {
      console.log('[GoogleMapVisualization] No simulation actors found for risk points');
      return [];
    }
    
    const allRoutePoints: {lat: number, lng: number}[] = [];
    
    simulation.actors.forEach(actor => {
      if (!actor.destinations || actor.destinations.length < 2) return;
      
      // Add all destination points
      actor.destinations.forEach(dest => {
        allRoutePoints.push({
          lat: dest.latitude,
          lng: dest.longitude
        });
      });
      
      // Add points from route paths if available
      for (let i = 0; i < actor.destinations.length - 1; i++) {
        const routeId = `${actor.id}-route-${i}`;
        const routeData = routePathsRef.current.get(routeId);
        
        if (routeData && routeData.path.length > 0) {
          // Sample points from the path (not every point to avoid too many)
          const samplingRate = Math.max(1, Math.floor(routeData.path.length / 10));
          
          for (let j = 0; j < routeData.path.length; j += samplingRate) {
            const point = routeData.path[j];
            allRoutePoints.push({
              lat: point.lat(),
              lng: point.lng()
            });
          }
        }
      }
    });
    
    console.log('[GoogleMapVisualization] Extracted', allRoutePoints.length, 'route points for risk assessment');
    return allRoutePoints;
  };

  // Update risk heatmap when routes change - debounced to ensure routes are loaded
  useEffect(() => {
    if (!map) {
      console.log('[GoogleMapVisualization] No map available for risk heatmap');
      return;
    }
    
    if (!riskHeatmapRef.current) {
      console.log('[GoogleMapVisualization] Risk heatmap ref not initialized');
      return;
    }
    
    if (!simulation) {
      console.log('[GoogleMapVisualization] No simulation available for risk heatmap');
      return;
    }
    
    // Wait a bit to ensure routes are loaded
    const timer = setTimeout(() => {
      const routePoints = extractRoutePoints();
      
      if (routePoints.length === 0) {
        console.log('[GoogleMapVisualization] No route points found for risk assessment');
        return;
      }
      
      console.log('[GoogleMapVisualization] Updating risk heatmap with', routePoints.length, 'points');
      
      // Try to fetch risk assessment from backend
      const updateRiskHeatmap = async () => {
        try {
          console.log('[GoogleMapVisualization] Fetching risk assessment from backend');
          // Fetch risk data from backend
          const riskPoints = await fetchRouteRiskAssessment(routePoints);
          console.log('[GoogleMapVisualization] Received', riskPoints.length, 'risk points from backend');
          
          // Update heatmap with fetched data
          if (riskHeatmapRef.current && riskPoints.length > 0) {
            riskHeatmapRef.current.setRiskData(riskPoints);
            riskHeatmapRef.current.setVisible(showRiskHeatmap);
            console.log('[GoogleMapVisualization] Risk heatmap updated with backend data');
          }
        } catch (error) {
          console.error('[GoogleMapVisualization] Failed to fetch risk assessment, using fallback', error);
          
          // Fallback: generate client-side risk data
          if (simulation.actors && simulation.actors.length > 0) {
            console.log('[GoogleMapVisualization] Using fallback risk calculation');
            
            // Get the first route with directions
            let foundRoute = false;
            for (const actor of simulation.actors) {
              if (foundRoute) break;
              
              for (let i = 0; i < actor.destinations.length - 1; i++) {
                const routeId = `${actor.id}-route-${i}`;
                const route = directionsRendererRef.current.get(routeId);
                
                if (route?.getDirections()?.routes[0]) {
                  console.log('[GoogleMapVisualization] Found route for fallback risk calculation');
                  const fallbackRiskPoints = generateRouteRiskPoints(route.getDirections()!.routes[0]);
                  
                  if (riskHeatmapRef.current && fallbackRiskPoints.length > 0) {
                    console.log('[GoogleMapVisualization] Generated', fallbackRiskPoints.length, 'fallback risk points');
                    riskHeatmapRef.current.setRiskData(fallbackRiskPoints);
                    riskHeatmapRef.current.setVisible(showRiskHeatmap);
                  }
                  foundRoute = true;
                  break;
                }
              }
            }
            
            if (!foundRoute) {
              console.log('[GoogleMapVisualization] No suitable route found for fallback risk calculation');
            }
          }
        }
      };
      
      updateRiskHeatmap();
    }, 1000); // Wait 1 second after routes change
    
    return () => clearTimeout(timer);
  }, [map, simulation, showRiskHeatmap]);
  
  // Toggle risk heatmap visibility explicitly
  useEffect(() => {
    if (!riskHeatmapRef.current) {
      console.log('[GoogleMapVisualization] Cannot toggle visibility - risk heatmap not initialized');
      return;
    }
    
    console.log('[GoogleMapVisualization] Setting risk heatmap visibility:', showRiskHeatmap);
    riskHeatmapRef.current.setVisible(showRiskHeatmap);
  }, [showRiskHeatmap]);
  
  // Clean up risk heatmap on unmount
  useEffect(() => {
    return () => {
      if (riskHeatmapRef.current) {
        console.log('[GoogleMapVisualization] Cleaning up risk heatmap on component unmount');
        riskHeatmapRef.current.clear();
        riskHeatmapRef.current = null;
      }
    };
  }, []);

  // Add risk heatmap visibility to the existing ensureRoutesVisible function
  const ensureRoutesVisible = () => {
    if (!map) return;
    
    // Make sure all directions renderers are visible
    directionsRendererRef.current.forEach((renderer, id) => {
      if (renderer.getMap() !== map) {
        console.log(`[GoogleMapVisualization] Restoring visibility of directions renderer: ${id}`);
        renderer.setMap(map);
      }
    });
    
    // Make sure all polylines are visible
    polylineRef.current.forEach((polyline, id) => {
      if (polyline.getMap() !== map) {
        console.log(`[GoogleMapVisualization] Restoring visibility of polyline: ${id}`);
        polyline.setMap(map);
      }
    });
    
    // Ensure risk heatmap is visible if it should be
    if (riskHeatmapRef.current && showRiskHeatmap) {
      console.log('[GoogleMapVisualization] Ensuring risk heatmap visibility during route refresh');
      riskHeatmapRef.current.setVisible(true);
    }
  };

  // Ensure markers stay visible
  const ensureMarkersVisible = () => {
    if (!map || !simulation) return;
    
    simulation.actors.forEach(actor => {
      const marker = markersRef.current.get(actor.id);
      if (marker && marker.getMap() !== map) {
        console.log(`[GoogleMapVisualization] Restoring visibility of marker for actor: ${actor.name}`);
        marker.setMap(map);
      }
    });
  };

  // Modify the playbackState effect to also check markers
  useEffect(() => {
    console.log('[GoogleMapVisualization] Playback state changed, ensuring visibility');
    ensureRoutesVisible();
    ensureMarkersVisible();
  }, [playbackState, map, simulation]);

  // Helper function to create an appropriate icon for each actor type
  const getActorIcon = (actor: Actor): google.maps.Symbol | google.maps.Icon => {
    
    // Default scale and color settings
    const actorSettings = {
      plane: { scale: 1.2, fillColor: '#FF6666' },
      helicopter: { scale: 1.2, fillColor: '#FF66FF' },
      ship: { scale: 1.0, fillColor: '#66FF66' },
      truck: { scale: 1.0, fillColor: '#FFAA66' },
      car: { scale: 0.9, fillColor: '#FFFFFF' },
      train: { scale: 1.1, fillColor: '#6666FF' }
    };
    
    // Determine which actor type to use for the icon
    let actorType = actor.type.toLowerCase();
    
    // Map our type to the most appropriate icon
    if (actorType.includes('car')) actorType = 'car';
    else if (actorType.includes('plane')) actorType = 'plane';
    else if (actorType.includes('helicopter')) actorType = 'helicopter';
    else if (actorType.includes('ship') || actorType.includes('boat')) actorType = 'ship';
    else if (actorType.includes('truck')) actorType = 'truck';
    else if (actorType.includes('train')) actorType = 'train';
    else actorType = 'car'; // Default
    
    // Get the appropriate settings
    const settings = actorSettings[actorType as keyof typeof actorSettings] || 
                    actorSettings.car; // Default to car if type not found
    
    // Get the appropriate path
    const path = actorPaths[actorType as keyof typeof actorPaths] || 
                actorPaths.car; // Default to car if type not found

    // Create the icon with the custom path and settings
    return {
      path: path,
      scale: settings.scale,
      fillColor: settings.fillColor,
      fillOpacity: 1,
      strokeWeight: 1,
      strokeColor: '#FFFFFF',
      anchor: new google.maps.Point(12, 12) // Center of the 24x24 viewBox
    };
  };

  // Helper function to create info window content
  const createInfoWindowContent = (actor: Actor, animState: ActorAnimationState2D): string => {
    // Get current and next destination
    const currentDest = actor.destinations[animState.currentDestIndex].destination;
    const nextDest = actor.destinations[Math.min(animState.currentDestIndex + 1, actor.destinations.length - 1)].destination;
    
    // Calculate overall progress
    const segmentProgress = animState.progress;
    const overallProgress = (animState.currentDestIndex + segmentProgress) / (actor.destinations.length - 1);
    
    return `
      <div style="padding: 10px; max-width: 200px;">
        <h3 style="margin: 0 0 5px 0; color: #333;">${actor.name}</h3>
        <p style="margin: 0 0 5px 0;"><strong>Type:</strong> ${actor.type}</p>
        <p style="margin: 0 0 5px 0;"><strong>From:</strong> ${currentDest?.name || 'Unknown'}</p>
        <p style="margin: 0 0 5px 0;"><strong>To:</strong> ${nextDest?.name || 'End'}</p>
        <p style="margin: 0 0 5px 0;"><strong>Progress:</strong> ${Math.round(overallProgress * 100)}%</p>
      </div>
    `;
  };

  // Helper function to get position on a path based on progress
  function getPositionOnPath(path: google.maps.LatLng[], progress: number): google.maps.LatLng {
    if (path.length <= 1) return path[0];
    if (progress <= 0) return path[0];
    if (progress >= 1) return path[path.length - 1];
    
    // Calculate the total distance of the path
    let totalDistance = 0;
    const distances: number[] = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const segmentDistance = google.maps.geometry.spherical.computeDistanceBetween(path[i], path[i+1]);
      distances.push(segmentDistance);
      totalDistance += segmentDistance;
    }
    
    // Find the target distance based on progress
    const targetDistance = progress * totalDistance;
    
    // Find the segment containing the target distance
    let currentDistance = 0;
    for (let i = 0; i < distances.length; i++) {
      if (currentDistance + distances[i] >= targetDistance) {
        // Calculate progress within this segment
        const segmentProgress = (targetDistance - currentDistance) / distances[i];
        
        // Interpolate between the segment's start and end points
        return google.maps.geometry.spherical.interpolate(
          path[i],
          path[i + 1],
          segmentProgress
        );
      }
      currentDistance += distances[i];
    }
    
    // Fallback to the last point if something went wrong
    return path[path.length - 1];
  }

  // Add a function to calculate the total route distance for an actor
  function calculateTotalRouteDistance(actor: Actor): number {
    let totalDistance = 0;
    
    if (!actor.destinations || actor.destinations.length < 2) return 0;
    
    // Sum up distances for all route segments
    for (let i = 0; i < actor.destinations.length - 1; i++) {
      const routeId = `${actor.id}-route-${i}`;
      const routeData = routePathsRef.current.get(routeId);
      
      if (routeData) {
        totalDistance += routeData.distance;
      } else {
        // Fallback: calculate direct distance if no route data
        const source = actor.destinations[i];
        const target = actor.destinations[i+1];
        const sourceLatLng = new google.maps.LatLng(source.latitude, source.longitude);
        const targetLatLng = new google.maps.LatLng(target.latitude, target.longitude);
        totalDistance += google.maps.geometry.spherical.computeDistanceBetween(sourceLatLng, targetLatLng);
      }
    }
    
    return totalDistance;
  }

  // Add a function to calculate the actual distance traveled
  function calculateDistanceTraveled(actor: Actor, currentDestIndex: number, progress: number): number {
    let distanceTraveled = 0;
    
    if (!actor.destinations || actor.destinations.length < 2) return 0;
    
    // Add up completed segments
    for (let i = 0; i < currentDestIndex; i++) {
      const routeId = `${actor.id}-route-${i}`;
      const routeData = routePathsRef.current.get(routeId);
      
      if (routeData) {
        distanceTraveled += routeData.distance;
      } else {
        // Fallback: calculate direct distance if no route data
        const source = actor.destinations[i];
        const target = actor.destinations[i+1];
        const sourceLatLng = new google.maps.LatLng(source.latitude, source.longitude);
        const targetLatLng = new google.maps.LatLng(target.latitude, target.longitude);
        distanceTraveled += google.maps.geometry.spherical.computeDistanceBetween(sourceLatLng, targetLatLng);
      }
    }
    
    // Add current segment (partial)
    const currentRouteId = `${actor.id}-route-${currentDestIndex}`;
    const currentRouteData = routePathsRef.current.get(currentRouteId);
    
    if (currentRouteData) {
      distanceTraveled += currentRouteData.distance * progress;
    } else {
      // Fallback
      const source = actor.destinations[currentDestIndex];
      const target = actor.destinations[Math.min(currentDestIndex+1, actor.destinations.length-1)];
      const sourceLatLng = new google.maps.LatLng(source.latitude, source.longitude);
      const targetLatLng = new google.maps.LatLng(target.latitude, target.longitude);
      distanceTraveled += google.maps.geometry.spherical.computeDistanceBetween(sourceLatLng, targetLatLng) * progress;
    }
    
    return distanceTraveled;
  }

  // This component doesn't render anything directly
  return null;
};

export default GoogleMapVisualization;