import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  simulationService,
  Simulation,
  Actor,
  PlaybackState,
  initialPlaybackState,
} from '../services/SimulationService';
import { useRiskAssessment, RiskPoint, fetchRouteRiskAssessment, generateRouteRiskPoints } from '../hooks/useRiskAssessment';
import { calculateHeading, getPositionAlongRoute, calculateCartesianFromGeodetic, calculateGeodeticFromCartesian } from '../utils/geospatial';
import { simulationTextInputAtom } from './CreatorToolContainer';
import Actor3D from './Actor3D';
import RouteVisualization from './RouteVisualization';
import RouteArc from './RouteArc';
import RouteWater from './RouteWater';
import { mapFocusLocationAtom } from '../helpers/states';
import { googleMapsLoadedAtom } from './GoogleMapLoader';
import ThreeRiskHeatmap from './ThreeRiskHeatmap';


// Define the structure for the animation state stored in the ref and state
interface ActorAnimStateValue {
    progress: number;
    currentDestIndex: number;
    position: [number, number];
    heading: number;
}

// Type for the ref and state
type ActorAnimStatesType = Record<string, ActorAnimStateValue>;


// Track position for each actor during animation
export interface ActorAnimationState3D extends Actor {
  position: [number, number]; // [lng, lat]
  progress: number;
  destinations: { latitude: number; longitude: number; name?: string; }[];
  currentDestIndex: number;
  heading: number;
}

interface DisplayRoute {
  id: string;
  origin: { coordinates: [number, number] };
  destination: { coordinates: [number, number] };
  waypoints: [number, number][];
  actorType?: string;
  detailedPath?: [number, number][];
  riskPoints?: RiskPoint[];
  segmentPathCoords?: [number, number][];
}

interface SimulationManagerProps {}

// Helper function to calculate the total distance of a geodetic path
const calculatePathDistance = (path: [number, number][]): number => {
    if (!window.google || !window.google.maps || !window.google.maps.geometry || path.length < 2) {
        return 0;
    }
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = new window.google.maps.LatLng(path[i][1], path[i][0]);
        const p2 = new window.google.maps.LatLng(path[i + 1][1], path[i + 1][0]);
        totalDistance += window.google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
    }
    return totalDistance;
};

// Helper function to get position on a geodetic path based on progress (0-1)
const getGeodeticPositionOnPath = (path: [number, number][], progress: number): [number, number] | null => {
    if (!window.google || !window.google.maps || !window.google.maps.geometry || path.length === 0) {
        return null;
    }
    if (path.length === 1 || progress <= 0) return path[0];
    if (progress >= 1) return path[path.length - 1];

    const totalDistance = calculatePathDistance(path);
    if (totalDistance <= 0) return path[0]; // Avoid division by zero

    const targetDistance = progress * totalDistance;
    let cumulativeDistance = 0;

    for (let i = 0; i < path.length - 1; i++) {
        const p1LatLng = new window.google.maps.LatLng(path[i][1], path[i][0]);
        const p2LatLng = new window.google.maps.LatLng(path[i + 1][1], path[i + 1][0]);
        const segmentDistance = window.google.maps.geometry.spherical.computeDistanceBetween(p1LatLng, p2LatLng);

        if (cumulativeDistance + segmentDistance >= targetDistance) {
            const segmentProgress = segmentDistance > 0 ? (targetDistance - cumulativeDistance) / segmentDistance : 0;
            const interpolatedLatLng = window.google.maps.geometry.spherical.interpolate(
                p1LatLng,
                p2LatLng,
                segmentProgress
            );
            return [interpolatedLatLng.lng(), interpolatedLatLng.lat()];
        }
        cumulativeDistance += segmentDistance;
    }

    // Fallback if something went wrong (e.g., floating point issues)
    return path[path.length - 1];
};

const SimulationManager: React.FC<SimulationManagerProps> = () => {
  const [simulation, setSimulation] = useState<Simulation | null>(simulationService.getSimulation());
  const [playbackState, setPlaybackState] = useState<PlaybackState>(simulationService.getPlaybackState());
  
  // *** USE STATE AND REF ***
  // State to trigger re-renders
  const [actorAnimStates, setActorAnimStates] = useState<ActorAnimStatesType>({});
  // Ref to hold the canonical calculation state
  const actorAnimStatesRef = useRef<ActorAnimStatesType>({});
  // *** END STATE AND REF ***

  const [detailedPaths, setDetailedPaths] = useState<Record<string, [number, number][]>>({});
  const { riskPoints: simulationRiskPoints, isLoading: isLoadingRisk, error: riskError } = useRiskAssessment(simulation, detailedPaths);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const setMapFocusLocation = useSetAtom(mapFocusLocationAtom);
  const inputText = useAtomValue(simulationTextInputAtom);
  const isGoogleMapsLoaded = useAtomValue(googleMapsLoadedAtom);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const { camera } = useThree();
  const isInitialFitDone = useRef<boolean>(false);

  useEffect(() => {
    if (isGoogleMapsLoaded && !directionsServiceRef.current && window.google) {
      console.log('[SimulationManager] Initializing Directions Service');
      directionsServiceRef.current = new window.google.maps.DirectionsService();
    }
  }, [isGoogleMapsLoaded]);

  useEffect(() => {
    const handleUpdate = () => {
      const currentSim = simulationService.getSimulation();
      const currentPlayback = simulationService.getPlaybackState();
      
      console.log('[SimulationManager] Received update from SimulationService', { currentSim, currentPlayback });

      const simChanged = !simulation || currentSim?.id !== simulation.id;
      const shouldReset = currentPlayback.isReset;

      setSimulation(currentSim);
      setPlaybackState(currentPlayback);

      if (currentSim && (simChanged || shouldReset)) {
        console.log('[SimulationManager] Simulation changed or reset detected.');
        initializeActorAnimationStates(currentSim);
        if (simChanged) {
             console.log('[SimulationManager] Clearing detailed paths due to simulation change.');
             setDetailedPaths({});
             isInitialFitDone.current = false;
        }
      }
    };

    const unsubscribe = simulationService.subscribe(handleUpdate);
    handleUpdate();

    return unsubscribe;
  }, [simulation]);
  
  useEffect(() => {
    if (!simulation || !directionsServiceRef.current || !window.google?.maps?.TravelMode) {
        console.log('[SimulationManager] Skipping directions fetch: Conditions not met.');
        return;
    }

    const directionsService = directionsServiceRef.current;
    const TravelMode = window.google.maps.TravelMode;
    const groundTypes = ['vehicle', 'bus', 'human', 'animal', 'car', 'truck', 'train'];
    let pendingRequests = 0;

    console.log('[SimulationManager] Checking routes for directions fetching...');

    simulation.actors.forEach(actor => {
      const actorWithDests = actor as ActorAnimationState3D;
      const actorType = (actor as any).type?.toLowerCase() || 'vehicle';

      if (groundTypes.includes(actorType) && actorWithDests.destinations && actorWithDests.destinations.length >= 2) {
        for (let i = 0; i < actorWithDests.destinations.length - 1; i++) {
          const source = actorWithDests.destinations[i];
          const target = actorWithDests.destinations[i + 1];
          const routeId = `${actor.id}-segment-${i}`;

          if (!detailedPaths[routeId] && source && target && source.latitude != null && source.longitude != null && target.latitude != null && target.longitude != null) {
            pendingRequests++;
            console.log(`[SimulationManager] Requesting directions for route: ${routeId} (Type: ${actorType})`);

            const request: google.maps.DirectionsRequest = {
              origin: { lat: source.latitude, lng: source.longitude },
              destination: { lat: target.latitude, lng: target.longitude },
              travelMode: actorType === 'train'
                  ? TravelMode.TRANSIT
                  : (actorType === 'human' || actorType === 'animal')
                      ? TravelMode.WALKING
                      : TravelMode.DRIVING,
            };

            new Promise<google.maps.DirectionsResult | null>((resolve) => {
              directionsService.route(request, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK && result) {
                  resolve(result);
                } else {
                  console.warn(`[SimulationManager] Directions request failed for route ${routeId}: ${status}`);
                  resolve(null);
                }
              });
            }).then(result => {
                pendingRequests--;
                if (result?.routes?.[0]?.overview_path) {
                    console.log(`[SimulationManager] Directions received for route: ${routeId}`);
                    const pathCoords: [number, number][] = result.routes[0].overview_path.map(p => [p.lng(), p.lat()]);
                    setDetailedPaths(prevPaths => ({
                        ...prevPaths,
                        [routeId]: pathCoords,
                    }));
                } else {
                    setDetailedPaths(prevPaths => ({
                        ...prevPaths,
                        [routeId]: [],
                    }));
                }
            });
          }
        }
      }
    });
     if (pendingRequests > 0) {
        console.log(`[SimulationManager] ${pendingRequests} directions requests initiated.`);
     } else {
        console.log(`[SimulationManager] No new directions requests needed.`);
     }

  }, [simulation, isGoogleMapsLoaded]);

  useEffect(() => {
    if (!simulation || !simulation.actors || simulation.actors.length === 0) {
      console.log('[SimulationManager] Skipping risk fetch: No simulation or actors.');
      return;
    }

    console.log('[SimulationManager] Preparing to fetch risk assessment data.');

    const pointsForRiskAssessment: { lat: number; lng: number }[] = [];
    const pointSet = new Set<string>();

    const addPoint = (lat: number | undefined, lng: number | undefined) => {
        if (lat != null && lng != null) {
            const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
            if (!pointSet.has(key)) {
                pointSet.add(key);
                pointsForRiskAssessment.push({ lat, lng });
            }
        }
    };

    simulation.actors.forEach(actor => {
      actor.destinations?.forEach(dest => addPoint(dest.latitude, dest.longitude));

      if (actor.destinations && actor.destinations.length >= 2) {
        for (let i = 0; i < actor.destinations.length - 1; i++) {
          const routeId = `${actor.id}-segment-${i}`;
          const path = detailedPaths[routeId];
          if (path && path.length > 0) {
            const samplingRate = Math.max(1, Math.floor(path.length / 10));
             for (let j = 0; j < path.length; j += samplingRate) {
                const [lng, lat] = path[j];
                addPoint(lat, lng);
             }
          }
        }
      }
    });

    if (pointsForRiskAssessment.length === 0) {
        console.log('[SimulationManager] No valid points found for risk assessment.');
        return;
    }

    console.log(`[SimulationManager] Collected ${pointsForRiskAssessment.length} unique points for risk assessment.`);

    const fetchRisk = async () => {
        try {
            console.log('[SimulationManager] Fetching risk assessment from backend...');
            const riskData = await fetchRouteRiskAssessment(pointsForRiskAssessment);
            console.log(`[SimulationManager] Received ${riskData.length} risk points from backend.`);
        } catch (error) {
            console.error('[SimulationManager] Error fetching risk assessment:', error);
        }
    };

    fetchRisk();

  }, [simulation]);

  const initializeActorAnimationStates = (sim: Simulation) => {
    console.log('[SimulationManager] Initializing/Resetting Actor Animation States');
    const newAnimStates: ActorAnimStatesType = {};
    
    sim.actors.forEach(actor => {
      const actorWithDests = actor as Actor;
      if (actorWithDests.destinations && actorWithDests.destinations.length > 0) {
        const firstDest = actorWithDests.destinations[0];
        
        if (firstDest && firstDest.longitude != null && firstDest.latitude != null) {
          const initialPosition: [number, number] = [firstDest.longitude, firstDest.latitude];
          let initialHeading = 0;

          if (actorWithDests.destinations.length > 1) {
            const nextDest = actorWithDests.destinations[1];
            
            if (nextDest && nextDest.longitude != null && nextDest.latitude != null) {
              const nextPosition: [number, number] = [nextDest.longitude, nextDest.latitude];
              const calculatedHeading = calculateHeading(initialPosition, nextPosition);
              initialHeading = calculatedHeading >= 0 ? calculatedHeading : 0;
            } else {
              console.warn(`[SimulationManager] Actor ${actor.name} (${actor.id}) has invalid second destination data.`);
            }
          }

          newAnimStates[actor.id] = {
            progress: 0,
            currentDestIndex: 0,
            position: initialPosition,
            heading: initialHeading,
          };
        } else {
           console.warn(`[SimulationManager] Actor ${actor.name} (${actor.id}) has invalid first destination data.`);
           newAnimStates[actor.id] = { progress: 0, currentDestIndex: 0, position: [0, 0], heading: 0 };
        }
      } else {
         console.warn(`[SimulationManager] Actor ${actor.name} (${actor.id}) has no destinations.`);
         newAnimStates[actor.id] = {
           progress: 0,
           currentDestIndex: 0,
           position: [0, 0],
           heading: 0,
         };
      }
    });
    actorAnimStatesRef.current = newAnimStates;
    setActorAnimStates(newAnimStates);
    console.log('[SimulationManager Init] Ref and State initialized:', actorAnimStatesRef.current);
  };

  useEffect(() => {
    if (inputText && inputText.trim()) {
      console.log('[SimulationManager] Input text changed, CreatorToolService handles API calls');
    }
  }, [inputText]);
  
  const animate = (time: number) => {
    const deltaTime = lastTimeRef.current ? time - lastTimeRef.current : 0;
    lastTimeRef.current = time;

    if (playbackState.isPlaying && !playbackState.isPaused) {
      let allActorsEffectivelyCompleted = true;
      const currentStatesFromRef = actorAnimStatesRef.current;
      const updatedStatesForRef: ActorAnimStatesType = {};

      if (!simulation || !simulation.actors) {
           console.warn("[SimMan Animate] No simulation or actors found, stopping animation.");
           if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
           animationFrameRef.current = null;
           return;
      }

      simulation.actors.forEach((actor) => {
         const actorWithDests = actor as Actor;
         if (!actorWithDests.destinations || actorWithDests.destinations.length < 2) {
             if (currentStatesFromRef[actor.id]) {
                 updatedStatesForRef[actor.id] = currentStatesFromRef[actor.id];
             }
            return;
         }

         const currentState = currentStatesFromRef[actor.id];
         if (!currentState) {
            console.warn(`[SimulationManager Animate] Animation state for actor ${actor.id} not found in ref. Skipping.`);
            allActorsEffectivelyCompleted = false;
            return;
         }

         const isAlreadyAtFinal = currentState.currentDestIndex >= actorWithDests.destinations.length - 1 &&
                                  currentState.progress >= 1.0;

         if (isAlreadyAtFinal) {
            const finalDest = actorWithDests.destinations[actorWithDests.destinations.length - 1];
            if (finalDest && finalDest.longitude != null && finalDest.latitude != null) {
               const finalPosition: [number, number] = [finalDest.longitude, finalDest.latitude];
                updatedStatesForRef[actor.id] = {
                   ...currentState,
                   progress: 1.0,
                   position: finalPosition,
                };
            } else {
                 updatedStatesForRef[actor.id] = currentState;
            }
            return;
         }

         allActorsEffectivelyCompleted = false;

         const actorSpeed = (actor as any).speed || 1.0;
         let frameProgressDelta = (deltaTime * actorSpeed * playbackState.speedMultiplier * 0.0002);
         let potentialNewProgress = currentState.progress + frameProgressDelta;

         let currentDestIndex = currentState.currentDestIndex;
         let finalFrameProgressValue = currentState.progress;
         let newPosition = currentState.position;
         let newHeading = currentState.heading;

         if (potentialNewProgress >= 1.0 && currentDestIndex < actorWithDests.destinations.length - 1) {
            currentDestIndex++;
            finalFrameProgressValue = 0;
            console.log(`[SimMan ProgCalc ${actor.id}] Segment Change! NewIndex: ${currentDestIndex}`);

            const reachedDest = actorWithDests.destinations[currentDestIndex];
            if (reachedDest && reachedDest.longitude != null && reachedDest.latitude != null) {
                 newPosition = [reachedDest.longitude, reachedDest.latitude];
                 const nextDestIndex = Math.min(currentDestIndex + 1, actorWithDests.destinations.length - 1);
                 const nextDest = actorWithDests.destinations[nextDestIndex];
                 if (nextDest && nextDest.longitude != null && nextDest.latitude != null) {
                    const nextPositionCoords: [number, number] = [nextDest.longitude, nextDest.latitude];
                    const calculatedHeading = calculateHeading(newPosition, nextPositionCoords);
                    if (calculatedHeading >= 0) {
                       newHeading = calculatedHeading;
                    }
                 }
            } else {
                console.warn(`[SimulationManager Animate] Invalid destination data at index ${currentDestIndex} for actor ${actor.id} during segment advance.`);
                newPosition = currentState.position;
            }
         } else {
            finalFrameProgressValue = Math.min(1.0, potentialNewProgress);
            console.log(`[SimMan ProgCalc ${actor.id}] Within Segment. FinalProgValue: ${finalFrameProgressValue.toFixed(5)}`);

            const source = actorWithDests.destinations[currentState.currentDestIndex];
            const targetIndex = Math.min(currentState.currentDestIndex + 1, actorWithDests.destinations.length - 1);
            const target = actorWithDests.destinations[targetIndex];

            if (source && target &&
                source.longitude != null && source.latitude != null &&
                target.longitude != null && target.latitude != null)
            {
                const routeId = `${actor.id}-segment-${currentState.currentDestIndex}`;
                const detailedSegmentPath = detailedPaths[routeId];
                let calculatedPosition: [number, number] | null = null;
                let lookAheadPosition: [number, number] | null = null;
                const lookAheadAmount = 0.01;

                if (detailedSegmentPath && detailedSegmentPath.length >= 2) {
                    calculatedPosition = getGeodeticPositionOnPath(detailedSegmentPath, finalFrameProgressValue);
                    if (finalFrameProgressValue < (1.0 - lookAheadAmount)) {
                        const lookAheadProgress = Math.min(1.0, finalFrameProgressValue + lookAheadAmount);
                        lookAheadPosition = getGeodeticPositionOnPath(detailedSegmentPath, lookAheadProgress);
                    } else {
                        lookAheadPosition = calculatedPosition;
                    }
                } else {
                    const sourceCoords: [number, number] = [source.longitude, source.latitude];
                    const targetCoords: [number, number] = [target.longitude, target.latitude];
                    calculatedPosition = getPositionAlongRoute(sourceCoords, targetCoords, finalFrameProgressValue);
                    if (finalFrameProgressValue < (1.0 - lookAheadAmount)) {
                       const lookAheadProgress = Math.min(1.0, finalFrameProgressValue + lookAheadAmount);
                       lookAheadPosition = getPositionAlongRoute(sourceCoords, targetCoords, lookAheadProgress);
                    } else {
                       lookAheadPosition = calculatedPosition;
                    }
                }

                if (calculatedPosition && !isNaN(calculatedPosition[0]) && !isNaN(calculatedPosition[1])) {
                    newPosition = calculatedPosition;
                } else {
                    console.warn(`[SimulationManager Animate] Failed to calculate position for actor ${actor.id}, using previous.`);
                    newPosition = currentState.position;
                }

                if (lookAheadPosition && newPosition && (lookAheadPosition[0] !== newPosition[0] || lookAheadPosition[1] !== newPosition[1])) {
                   const calculatedHeading = calculateHeading(newPosition, lookAheadPosition);
                   if (calculatedHeading >= 0) {
                       newHeading = calculatedHeading;
                   }
                }
            } else {
               console.warn(`[SimulationManager Animate] Invalid source/target for interpolation for actor ${actor.id} at index ${currentState.currentDestIndex}`);
               newPosition = currentState.position;
               newHeading = currentState.heading;
            }
         }

         updatedStatesForRef[actor.id] = {
           progress: finalFrameProgressValue,
           currentDestIndex: currentDestIndex,
           position: newPosition,
           heading: newHeading >= 0 ? newHeading : currentState.heading,
         };
      });

      actorAnimStatesRef.current = updatedStatesForRef;
      setActorAnimStates({ ...updatedStatesForRef });

      if (allActorsEffectivelyCompleted && playbackState.isPlaying) {
        console.log("[SimulationManager Animate] All actors reached final destination. Pausing.");
        simulationService.pause();
      }
    }

    if (playbackState.isPlaying && !playbackState.isPaused) {
       animationFrameRef.current = requestAnimationFrame(animate);
    } else {
       if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = null;
       }
    }
  };

  useEffect(() => {
    if (playbackState.isPlaying && !playbackState.isPaused) {
      console.log("[SimulationManager] Animation Loop Effect: Starting/Resuming");
      lastTimeRef.current = performance.now();
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    } else {
      console.log("[SimulationManager] Animation Loop Effect: Stopping/Pausing");
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        console.log("[SimulationManager] Animation frame cancelled on cleanup");
      }
    };
  }, [playbackState.isPlaying, playbackState.isPaused]);
  
  const handleDeleteActor = async (actorId: string) => {
    console.warn(`[SimulationManager] Deleting actor ${actorId} - Needs implementation via SimulationService`);
    const newRefStates = { ...actorAnimStatesRef.current };
    delete newRefStates[actorId];
    actorAnimStatesRef.current = newRefStates;
    setActorAnimStates(newRefStates);
  };

  const displayRoutes: DisplayRoute[] = useMemo(() => {
    if (!simulation?.actors) return [];

    const generatedRoutes: DisplayRoute[] = [];
    simulation.actors.forEach(actor => {
      const actorWithDests = actor as ActorAnimationState3D;
      if (!actorWithDests.destinations || actorWithDests.destinations.length < 2) return;

      const actorType = (actor as any).type?.toLowerCase() || 'vehicle';

      for (let i = 0; i < actorWithDests.destinations.length - 1; i++) {
        const source = actorWithDests.destinations[i];
        const target = actorWithDests.destinations[i + 1];
        
        if (source && target && 
            source.longitude != null && source.latitude != null &&
            target.longitude != null && target.latitude != null) {
          
          const routeId = `${actor.id}-segment-${i}`;
          const sourceCoords: [number, number] = [source.longitude, source.latitude];
          const targetCoords: [number, number] = [target.longitude, target.latitude];

          const fetchedPath = detailedPaths[routeId];
          const validDetailedPath = fetchedPath && fetchedPath.length >= 2 ? fetchedPath : undefined;
          const segmentPathCoords = validDetailedPath ? validDetailedPath : [sourceCoords, targetCoords];

          generatedRoutes.push({
            id: routeId,
            origin: { coordinates: sourceCoords },
            destination: { coordinates: targetCoords },
            waypoints: segmentPathCoords,
            actorType: actorType,
            detailedPath: validDetailedPath,
            riskPoints: simulationRiskPoints,
            segmentPathCoords: segmentPathCoords,
          });
        } else {
          console.warn(`[SimulationManager] Skipping route segment ${i} for actor ${actor.id} due to missing data.`);
        }
      }
    });
    console.log(`[SimulationManager] Generated ${generatedRoutes.length} display routes. Risk points available: ${simulationRiskPoints?.length ?? 0}`);
    return generatedRoutes;
  }, [simulation, detailedPaths, simulationRiskPoints]);

  useEffect(() => {
    if (!displayRoutes.length || isInitialFitDone.current || !simulation) {
        return;
    }

    console.log('[SimulationManager FitView] Calculating bounds for', displayRoutes.length, 'routes.');
    const box = new THREE.Box3();

    displayRoutes.forEach(route => {
       const pathCoords = route.segmentPathCoords;
       if (pathCoords) {
           pathCoords.forEach(([longitude, latitude]) => {
             if (typeof longitude === 'number' && typeof latitude === 'number' && !isNaN(longitude) && !isNaN(latitude)) {
               try {
                   const vector3Point = calculateCartesianFromGeodetic(latitude, longitude);
                   box.expandByPoint(vector3Point);
               } catch (e) { console.error(`Error converting point [${longitude}, ${latitude}]:`, e); }
             }
           });
       }
    });

    if (!box.isEmpty()) {
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        let centerLat: number, centerLon: number;
        try {
            const geodeticCenter = calculateGeodeticFromCartesian(center);
            centerLat = geodeticCenter.latitude;
            centerLon = geodeticCenter.longitude;
            console.log(`[SimulationManager FitView] Calculated Geo Center: Lat ${centerLat.toFixed(5)}, Lon ${centerLon.toFixed(5)}`);
        } catch (e) {
            console.error("[SimulationManager FitView] Error converting box center to geodetic:", e);
            return;
        }

        let fov = 60;
        if (camera instanceof THREE.PerspectiveCamera) {
            fov = camera.fov;
        } else {
            console.warn("[SimulationManager FitView] Camera is not PerspectiveCamera, using default FOV for distance estimate.");
        }
        const fovRad = fov * (Math.PI / 180);
        const maxDim = Math.max(size.x, size.y, size.z);
        const tanHalfFov = Math.tan(fovRad / 2);
        let estimatedDistance = tanHalfFov > 1e-6 ? Math.abs(maxDim / 2 / tanHalfFov) : maxDim * 2;
        estimatedDistance *= 1.7;
        estimatedDistance = Math.max(estimatedDistance, size.length() * 0.5, 1000);

        console.log(`[SimulationManager FitView] Estimated distance: ${estimatedDistance.toFixed(0)}m`);

        console.log(`[SimulationManager FitView] Setting map focus: Lat ${centerLat.toFixed(5)}, Lon ${centerLon.toFixed(5)}, Distance ${estimatedDistance.toFixed(0)}`);
        setMapFocusLocation({
            latitude: centerLat,
            longitude: centerLon,
            distance: estimatedDistance,
        });

        isInitialFitDone.current = true;
        console.log('[SimulationManager FitView] mapFocusLocationAtom updated.');

    } else {
      console.log('[SimulationManager FitView] Bounding box is empty, cannot fit view.');
    }
  }, [displayRoutes, simulation?.id, camera, setMapFocusLocation]);

  if (!simulation) {
    return null;
  }

  if (isLoadingRisk) {
     console.log("[SimulationManager] Loading risk assessment data...");
  }
  if (riskError) {
     console.error("[SimulationManager] Failed to load risk assessment data:", riskError);
  }

  return (
    <>
      {displayRoutes.map(route => {
        const isAirRoute = route.actorType === 'plane' || route.actorType === 'helicopter';
        const isWaterRoute = route.actorType === 'boat' || route.actorType === 'ship';

        const routeProps = {
            key: route.id,
            route: route,
            riskPoints: route.riskPoints,
        };

        if (isAirRoute) {
           if (!route.origin?.coordinates || !route.destination?.coordinates) {
              console.error('[SimulationManager] Skipping invalid route for RouteArc:', route);
              return null;
           }
          return (
            <RouteArc
              {...routeProps}
              color="#ffffff"
              lineWidth={1}
            />
          );
        } else if (isWaterRoute) {
           if (!route.waypoints || route.waypoints.length < 2) {
              console.error('[SimulationManager] Skipping invalid route for RouteWater:', route);
              return null;
           }
           return (
             <RouteWater 
               {...routeProps}
               width={4}
             />
           );
        } else {
          if (!route.waypoints || route.waypoints.length < 2) {
             console.error('[SimulationManager] Skipping invalid route for RouteVisualization:', route);
             return null;
          }
          return (
            <RouteVisualization
              key={route.id}
              {...routeProps}
            />
          );
        }
      })}

      {displayRoutes.map(route => {
        const pathForSegment = route.segmentPathCoords;

        if (!pathForSegment || pathForSegment.length < 2) {
            return null;
        }

        const isAirRoute = route.actorType === 'plane' || route.actorType === 'helicopter';
        const isWaterRoute = route.actorType === 'boat' || route.actorType === 'ship';
        if (isAirRoute || isWaterRoute) {
           return null;
        }

        return (
            <ThreeRiskHeatmap
                key={route.id + '-heatmap'}
                segmentPath={pathForSegment}
                riskPoints={route.riskPoints}
            />
        );
      })}
      
      {simulation.actors.map(actor => {
        const animState = actorAnimStates[actor.id];
        if (!animState || !actorAnimStatesRef.current[actor.id]) {
           if (!animState) console.warn(`[SimulationManager Render] No animState in REF for actor ${actor.id}, skipping render.`);
           return null;
        }

        const actorWithDests = actor as Actor;
        if (!Array.isArray(animState.position) || animState.position.length !== 2 || animState.position.some(isNaN)) {
           console.warn(`[SimulationManager Render] Invalid position in REF for actor ${actor.id}:`, animState.position, 'Skipping render.');
           return null;
        }

        const canMove = actorWithDests.destinations.length > 1;
        const overallProgress = canMove
          ? (animState.currentDestIndex + animState.progress) / (actorWithDests.destinations.length - 1)
          : (animState.progress >= 1.0 ? 1.0 : 0);

        const validHeading = typeof animState.heading === 'number' && !isNaN(animState.heading) ? animState.heading : 0;

        const actorFor3D: ActorAnimationState3D = {
          ...actor,
          position: animState.position,
          heading: validHeading,
          progress: Math.min(1, Math.max(0, overallProgress)),
          currentDestIndex: animState.currentDestIndex,
          destinations: actor.destinations
        };

        return (
          <Actor3D
            key={actor.id}
            actor={actorFor3D}
            isPlaying={playbackState.isPlaying}
            isPaused={playbackState.isPaused}
            onDelete={handleDeleteActor}
          />
        );
      })}
    </>
  );
};

export default SimulationManager;
