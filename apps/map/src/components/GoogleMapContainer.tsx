import React, { useEffect, useRef, useState } from 'react';
import { css } from '@emotion/react';
import { useAtomValue } from 'jotai';
import { mapFocusLocationAtom, showRealtimeDataAtom } from '../helpers/states';
import { googleMapsLoadedAtom } from './GoogleMapLoader';
import { simulationService, Simulation, PlaybackState } from '../services/SimulationService';
import GoogleMapVisualization from './GoogleMapVisualization';
import GoogleMapLiveUAEvents from './GoogleMapLiveUAEvents';
import GoogleMapNotams from './GoogleMapNotams';
import GoogleMapNotmars from './GoogleMapNotmars';
import { useNotams, Notam } from '../hooks/useNotams';
import { useLiveUAMapEvents, LiveUAMapEvent } from '../hooks/useLiveUAMapEvents';
import { useNotmars, Notmar } from '../hooks/useNotmars';

interface GoogleMapContainerProps {
  dayOfYear: number;
  timeOfDay: number;
  exposure: number;
  longitude: number;
  latitude: number;
  heading: number;
  pitch: number;
  distance: number;
  coverage: number;
}

const GoogleMapContainer: React.FC<GoogleMapContainerProps> = (props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const mapsLoaded = useAtomValue(googleMapsLoadedAtom);
  const mapFocusLocation = useAtomValue(mapFocusLocationAtom);
  const showRealtimeData = useAtomValue(showRealtimeDataAtom);

  // Get simulation data directly from service
  const [simulation, setSimulation] = useState<Simulation | null>(simulationService.getSimulation());
  const [playbackState, setPlaybackState] = useState<PlaybackState>(simulationService.getPlaybackState());

  // State to track if the map object is ready
  const [isMapReady, setIsMapReady] = useState(false);

  // Fetch NOTAMs and LiveUAMap Events
  const { data: notams, isLoading: isLoadingNotams, error: errorNotams } = useNotams();
  const { data: liveEvents, isLoading: isLoadingEvents, error: errorEvents } = useLiveUAMapEvents();
  const { data: notmars, isLoading: isLoadingNotmars, error: errorNotmars } = useNotmars({ chartNumber: '18645' });

  // Subscribe to simulation service changes
  useEffect(() => {
    const unsubscribe = simulationService.subscribe(() => {
      setSimulation(simulationService.getSimulation());
      setPlaybackState(simulationService.getPlaybackState());
    });
    
    return unsubscribe;
  }, []);

  // Initialize Google Map when the API is loaded
  useEffect(() => {
    // Use a local variable to track if initialization happened in this run
    let didInitialize = false;

    if (!mapsLoaded || !mapRef.current || googleMapRef.current) {
      // If map already exists, ensure readiness state is true
      if (googleMapRef.current && !isMapReady) {
        console.log('[GoogleMapContainer] Map already exists, ensuring isMapReady is true.');
        setIsMapReady(true);
      }
      return;
    }

    try {
      console.log('[GoogleMapContainer] Initializing Google Map');
      
      // Determine where to center the map:
      // 1. If there are actors, center on the first actor's first destination
      // 2. Otherwise use props coordinates or fallback to the focus location
      let centerLat = props.latitude || mapFocusLocation.latitude;
      let centerLng = props.longitude || mapFocusLocation.longitude;


      
      // If we have actors, center on the first one's first destination
      if (simulation && simulation.actors && simulation.actors.length > 0) {
        const firstActor = simulation.actors[0];
        if (firstActor.destinations && firstActor.destinations.length > 0) {
          const firstDest = firstActor.destinations[0];
          centerLng = firstDest.longitude;
          centerLat = firstDest.latitude;
          console.log('[GoogleMapContainer] Centering on first actor destination:', firstDest.name, 'at', centerLat, centerLng);
        }
      }
      
      // Calculate zoom based on distance (lower is further away)
      let zoom = 12; // Default zoom
      if (props.distance) {
        // Convert distance to zoom (logarithmic scale)
        zoom = Math.max(Math.round(16 - Math.log(props.distance / 500) / Math.log(2)), 8);
      }

      const mapOptions: google.maps.MapOptions = {
        center: { lat: centerLat, lng: centerLng },
        zoom: zoom,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: false,
        styles: [
          {
            featureType: 'all',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#ffffff' }]
          },
          {
            featureType: 'all',
            elementType: 'labels.text.stroke',
            stylers: [{ visibility: 'on' }, { color: '#3e606f' }, { weight: 2 }, { gamma: 0.84 }]
          },
          {
            featureType: 'administrative',
            elementType: 'geometry',
            stylers: [{ weight: 0.6 }, { color: '#1a3541' }]
          },
          {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ color: '#2c5a71' }]
          },
          {
            featureType: 'poi',
            elementType: 'geometry',
            stylers: [{ color: '#406d80' }]
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#29768a' }, { lightness: -37 }]
          },
          {
            featureType: 'transit',
            elementType: 'geometry',
            stylers: [{ color: '#406d80' }]
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#193341' }]
          }
        ]
      };

      const map = new google.maps.Map(mapRef.current, mapOptions);
      googleMapRef.current = map;
      didInitialize = true; // Mark initialization completed in this run
      
      console.log('[GoogleMapContainer] Google Map initialized, setting isMapReady to true.');
      setIsMapReady(true); // Trigger re-render now that map is ready
    } catch (error) {
      console.error('[GoogleMapContainer] Error initializing Google Map:', error);
      // Ensure state reflects failure if needed, though mapRef.current remains null
    }

    // Cleanup function (optional but good practice)
    return () => {
      // Optional: clean up map instance if component unmounts during initialization
      // Note: This cleanup might be too aggressive if the container unmounts often.
      // Consider if destroying/recreating the map frequently is desired.
      // if (didInitialize && googleMapRef.current) {
      //   console.log('[GoogleMapContainer] Cleanup: Potentially unmounting map instance');
      //   // google.maps.event.clearInstanceListeners(googleMapRef.current);
      //   // googleMapRef.current = null;
      //   // setIsMapReady(false); // Reset state if map is destroyed
      // }
    };
  }, [mapsLoaded, isMapReady, simulation]); // Added simulation dependency to update when it changes

  // Update map view props when they change (Keep this effect)
  useEffect(() => {
    if (!googleMapRef.current || !isMapReady) return; // Ensure map is ready before updates
    
    const map = googleMapRef.current;
    const centerLat = props.latitude || mapFocusLocation.latitude;
    const centerLng = props.longitude || mapFocusLocation.longitude;
    
    map.setCenter({ lat: centerLat, lng: centerLng });
    
    // Update zoom if distance changes
    if (props.distance) {
      const zoom = Math.max(Math.round(16 - Math.log(props.distance / 500) / Math.log(2)), 8);
      map.setZoom(zoom);
    }
  }, [props.latitude, props.longitude, props.distance, mapFocusLocation, isMapReady]); // Add isMapReady dependency

  // Define the type for the callback function
  type BoundsCalculatedCallback = (bounds: google.maps.LatLngBounds) => void;

  // Callback function to fit map bounds
  const handleBoundsCalculated: BoundsCalculatedCallback = (bounds) => {
    if (googleMapRef.current && !bounds.isEmpty()) {
      console.log('[GoogleMapContainer] Fitting map bounds to routes.', bounds.toJSON());
      googleMapRef.current.fitBounds(bounds);
      // Optional: Add padding if needed
      // googleMapRef.current.fitBounds(bounds, 50); // 50px padding
    }
  };

  // Determine overall loading state for real-time data
  const isLoadingRealtime = isLoadingNotams || isLoadingEvents || isLoadingNotmars;
  const realtimeError = errorNotams || errorEvents || errorNotmars;

  return (
    <div ref={mapRef} css={mapStyle}>
      {/* {isLoadingRealtime && <div>Loading map data...</div>}
      {realtimeError && <div>Error loading map data: {realtimeError.message}</div>} */}
      
      {!isLoadingRealtime && !realtimeError && isMapReady && googleMapRef.current && (
        <>
          {/* Simulation Visualization */}
          {simulation && simulation.actors && simulation.actors.length > 0 && (
            <GoogleMapVisualization
              map={googleMapRef.current}
              simulation={simulation}
              playbackState={playbackState}
              onBoundsCalculated={handleBoundsCalculated}
              onPause={() => simulationService.pause()}
              onPlay={() => simulationService.play()}
              onStop={() => simulationService.stop()}
            />
          )}
          
          {/* Real-time Data Layers - Conditionally Rendered based on atom */}

            <GoogleMapLiveUAEvents
              map={googleMapRef.current}
              events={liveEvents || []}
              show={showRealtimeData}
            />

            <GoogleMapNotams
              map={googleMapRef.current}
              notams={notams || []}
              show={showRealtimeData}
            />
            <GoogleMapNotmars
              map={googleMapRef.current}
              notmars={notmars || []}
              show={showRealtimeData}
            />
        </>
      )}
    </div>
  );
};

const mapStyle = css`
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
`;

export default GoogleMapContainer;