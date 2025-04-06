import React, { useState, useRef, useEffect } from 'react';
import { ThreeMapContainer } from './components/ThreeMapContainer';
import { css } from '@emotion/react';
import CreatorToolContainer from './components/CreatorToolContainer';
import MapMainMenu from './components/MapMainMenu';
import WeatherControlMenu from './components/WeatherControlMenu';
import GoogleMapLoader from './components/GoogleMapLoader';
import MapToolbar from './components/MapToolbar';
import GoogleMapContainer from './components/GoogleMapContainer';
import SimulationDetailSidebar from './components/SimulationDetailSidebar';
import TeamChatPanels from './components/TeamChatPanels';
import TeamWinStatePanel from './components/TeamWinStatePanel';

import { useAtom, useAtomValue } from 'jotai';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import { mapViewModeAtom } from './helpers/states';
import { simulationService, webSocketStatusAtom } from './services/SimulationService';
import { addDebugMessage } from './components/InfoPanel';

// Define entity types and interfaces
type EntityType = 'car' | 'pedestrian' | 'bus' | 'firetruck' | 'plane' | 'ship';

// Define the props for the SimulationContainer
interface SimulationContainerProps {
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

const SimulationContainer: React.FC<SimulationContainerProps> = (props) => {
  
  // References for Google Maps objects
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMapMutableRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  // Track current simulation and playback state
  const [simulation, setSimulation] = useState(simulationService.getSimulation());
  const [playbackState, setPlaybackState] = useState(simulationService.getPlaybackState());

  // Get WebSocket status from atom
  const wsStatus = useAtomValue(webSocketStatusAtom);

  // Subscribe to simulation service changes (for sim/playback state)
  useEffect(() => {
    const unsubscribe = simulationService.subscribe(() => {
      setSimulation(simulationService.getSimulation());
      setPlaybackState(simulationService.getPlaybackState());
    });
    
    return unsubscribe;
  }, []);

  // --- Initialize WebSocket connection on mount ---
  useEffect(() => {
    addDebugMessage('[System] Initializing WebSocket...');
    simulationService.connectWebSocket()
      .then(() => {
         // No need to add debug message here, service handlers do that
      })
      .catch(error => {
         addDebugMessage(`[System] Initial WebSocket connection failed: ${error.message}`);
      });

    // Cleanup function for unmount
    return () => {
      addDebugMessage('[System] Disconnecting WebSocket...');
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Track Google Maps API loading state
  const [mapsApiLoaded, setMapsApiLoaded] = useState(false);
  const [mapsApiError, setMapsApiError] = useState<Error | null>(null);

  // Handle Google Maps API loading
  const handleMapsApiLoaded = () => {
    setMapsApiLoaded(true);
  };
  
  // Store map instance in refs when loaded
  const handleMapLoaded = (map: google.maps.Map) => {
    if (googleMapRef.current === map) {
      console.debug('[SimulationContainer] Map already initialized, skipping');
      return;
    }
    googleMapRef.current = map;
    googleMapMutableRef.current = map;
    if (window.google && window.google.maps && !infoWindowRef.current) {
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }
    map.setCenter({ lat: props.latitude, lng: props.longitude });
    let zoom = 12;
    if (props.distance) {
      zoom = Math.max(Math.round(16 - Math.log(props.distance / 500) / Math.log(2)), 8);
    }
    map.setZoom(zoom);
  };

  const handleMapsApiError = (error: Error | string) => {
    console.error('[SimulationContainer] Failed to load Google Maps API:', error);
    setMapsApiError(error instanceof Error ? error : new Error(String(error)));
  };

  return (
    <div css={containerStyle}>
      {/* Google Maps API Loader */}
      <GoogleMapLoader 
        onLoad={handleMapsApiLoaded} 
        onError={handleMapsApiError}
      />

      {/* Map Toolbar */}
      <MapToolbar wsStatus={wsStatus}/>

      {/* Team Chat Panels - Now self-contained */}
      <TeamChatPanels />

      {/* Team Chat Panels - Now self-contained */}
      <TeamWinStatePanel />
      
      {/* 3D or 2D Map View */}
      {useAtomValue(mapViewModeAtom) === '3D' ? (
        <ThreeMapContainer {...props} />
      ) : (
        // Ensure GoogleMapContainer receives necessary props if mapsApiLoaded
        // ABSOLUTELY NO LOADING INDICATORS - DO NOT ADD ANYTHING HERE
        mapsApiLoaded ? <GoogleMapContainer {...props} onMapLoad={handleMapLoaded} /> : <div></div>
      )}
  
      {/* UI Elements */}
      <MapMainMenu />
      <WeatherControlMenu />
      {simulation && simulation.actors && simulation.actors.length > 0 && (
        <SimulationDetailSidebar 
          playbackState={playbackState}
          onPlay={() => simulationService.play()}
          onPause={() => simulationService.pause()}
          onStop={() => simulationService.stop()}
          onSpeedChange={(speed) => simulationService.setSpeed(speed)}
        />
      )}
      <CreatorToolContainer />
    </div>
  );
};

// Styles using emotion css
const containerStyle = css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const toggleMapButtonStyle = css`
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: #394b59;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 1000;
  font-size: 14px;
  
  &:hover {
    background-color: #30404d;
  }
`;

const toggleHeatmapButtonStyle = css`
  position: absolute;
  top: 50px;
  right: 10px;
  background-color: #394b59;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 1000;
  font-size: 14px;
  
  &:hover {
    background-color: #30404d;
  }
`;

const sidebarContainerStyle = (isVisible: boolean) => css`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 33%;
  min-width: 360px;
  transform: translateX(${isVisible ? '0' : '-100%'});
  transition: transform 0.3s ease-in-out;
  z-index: 1200;
`;

const toggleButtonStyle = (isVisible: boolean) => css`
  position: absolute;
  top: 50%;
  left: ${isVisible ? '33%' : '0'};
  transform: translateY(-50%);
  width: 24px;
  height: 60px;
  background-color: #394b59;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
  z-index: 1201;
  transition: left 0.3s ease-in-out;
  
  &:hover {
    background-color: #30404d;
  }
`;

export default SimulationContainer;
