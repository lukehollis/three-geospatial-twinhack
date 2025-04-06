import React, { useState, useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { Billboard, Circle, Html, Text, Ring } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Geodetic } from '@takram/three-geospatial';
import { useLiveUAMapEvents, LiveUAMapEvent } from '../hooks/useLiveUAMapEvents'; // Import hook and type
import { showRealtimeDataAtom, mapFocusLocationAtom } from '../helpers/states'; // Import the required atoms


interface EventMarkerProps {
  event: LiveUAMapEvent;
  onClick: () => void;
  isSelected: boolean;
}

const MARKER_COLOR = '#222222'; // dark background for circle center 
const RING_COLOR = '#FFFFFF'; // white color for ring  
const OUTER_RING_COLOR = '#000000'; // black color for outer ring
const MARKER_SIZE = 160; // Adjust size as needed in world units
const INFO_BOX_STYLE: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.8)',
  color: 'white',
  padding: '12px 15px',
  borderRadius: '5px',
  fontSize: '14px',
  minWidth: '360px',
  maxWidth: '420px',
  pointerEvents: 'auto', // Allow interaction with the info box content
  whiteSpace: 'pre-wrap', // Preserve line breaks in event name
  textAlign: 'left',
};

const EventMarker: React.FC<EventMarkerProps> = ({ event, onClick, isSelected }) => {
  const { camera } = useThree();
  const [isHovered, setIsHovered] = useState(false);

  // Convert lat/lng to ECEF coordinates
  const position = useMemo(() => {
    if (typeof event.lat !== 'number' || typeof event.lng !== 'number' || isNaN(event.lat) || isNaN(event.lng)) {
        console.warn(`[ThreeLiveUAEvents] Invalid coordinates for event ${event.event_id}:`, event.lat, event.lng);
        return new THREE.Vector3(0, 0, 0); // Default position or handle differently
      }
    const geodetic = new Geodetic(
      THREE.MathUtils.degToRad(event.lng),
      THREE.MathUtils.degToRad(event.lat),
      100 // Altitude offset - adjust as needed to make markers visible above terrain/buildings
    );
    return geodetic.toECEF();
  }, [event.lat, event.lng, event.event_id]);


  return (
    <Billboard position={position}>
      {/* Clickable Circle Marker */}
        <Ring
            args={[MARKER_SIZE, MARKER_SIZE + 64, 32]} // inner, outer, segments
            material-color={OUTER_RING_COLOR}
            material-transparent={true}
            material-opacity={0.9}
            material-side={THREE.DoubleSide} // Make sure it's visible from both sides
        />
        <Ring
            args={[MARKER_SIZE, MARKER_SIZE + 60, 32]} // inner, outer, segments
            material-color={RING_COLOR}
            material-transparent={true}
            material-opacity={1}
            material-side={THREE.DoubleSide} // Make sure it's visible from both sides
        />
       <Circle
         args={[MARKER_SIZE, 32]} // radius, segments
         onClick={(e) => {
             e.stopPropagation(); // Prevent triggering globe controls
             onClick();
         }}
         onPointerOver={(e) => {
             e.stopPropagation();
             setIsHovered(true);
             document.body.style.cursor = 'pointer';
         }}
         onPointerOut={(e) => {
             e.stopPropagation();
             setIsHovered(false);
             document.body.style.cursor = 'default';
         }}
         material-color={isHovered ? 'cyan' : MARKER_COLOR}
         material-transparent={true}
         material-opacity={0.9}
         material-side={THREE.DoubleSide} // Make sure it's visible from both sides
       />

      {/* Info Box displayed using Html */}
      {isSelected && (
        <Html
          position={[0, MARKER_SIZE * 1.5, 0]} // Position slightly above the marker
          center // Centers the Html content relative to the anchor point
          transform={false} 
          occlude // Allows the info box to be hidden by other 3D objects
          zIndexRange={[100, 0]} // Render Html on top
          style={{ pointerEvents: 'none' }} // Disable pointer events on the container itself
        >
          <div style={INFO_BOX_STYLE}>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>  
                <button 
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0 5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Call the onClick prop passed down from the parent
                        onClick(); 
                    }}
                >
                    Close

                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="currentColor"><title>close</title><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" /></svg>
                </button>
            </div>
            <p style={{ fontSize: '12px' }}>
            {new Date(event.timestamp).toLocaleString()}
            </p>
            <p style={{margin: '8px 0'}}>
                <strong>{event.name}</strong>
            </p>
            <p>
            {event.link && (
                <a
                  href={event.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'cyan', textDecoration: 'underline' }}
                  onClick={(e) => e.stopPropagation()} // Allow clicking the link
                >
                  View Source
                </a>
            )}
            </p>
          </div>
        </Html>
      )}
    </Billboard>
  );
};

const HIDE_DISTANCE_THRESHOLD = 100000; // Hide events if camera distance exceeds this

const ThreeLiveUAEvents: React.FC = () => {
  // Read the global toggle state
  const showRealtime = useAtomValue(showRealtimeDataAtom);
  // Read the current map focus location, which includes camera distance
  const mapFocusLocation = useAtomValue(mapFocusLocationAtom);

  // Fetch events using the hook - MUST be called unconditionally
  const { data: events, isLoading, error } = useLiveUAMapEvents();
  // State hook - MUST be called unconditionally
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Add logging for distance changes
  useEffect(() => {
    console.log(`[ThreeLiveUAEvents] Map focus distance updated: ${mapFocusLocation.distance}`);
  }, [mapFocusLocation.distance]);

  // ---- Conditional logic AFTER hooks ----

  // If toggled off, render nothing
  if (!showRealtime) {
    return null;
  }
  
  // If camera distance is too far, render nothing
  if (mapFocusLocation.distance && mapFocusLocation.distance > HIDE_DISTANCE_THRESHOLD) {
      console.log(`[ThreeLiveUAEvents] Hiding events due to distance: ${mapFocusLocation.distance}`);
      return null;
  }

  // Handle loading and error states (can stay here or move before showRealtime check)
  if (isLoading) {
    // Optional: Add a loading indicator in 3D space if desired
    console.log('[ThreeLiveUAEvents] Loading events...');
    return null;
  }
  if (error) {
    console.error('[ThreeLiveUAEvents] Error fetching events:', error);
    return null; // Don't render anything on error
  }
  if (!events || events.length === 0) {
    console.log('[ThreeLiveUAEvents] No events to display.');
    return null; // Don't render anything if there are no events
  }

  // console.log(`[ThreeLiveUAEvents] Rendering ${events.length} events.`);

  return (
    <group>
      {/* Add type annotation here */}
      {events.map((event: LiveUAMapEvent) => (
        <EventMarker
          key={event.event_id}
          event={event}
          isSelected={selectedEventId === event.event_id}
          onClick={() => {
            console.log(`[ThreeLiveUAEvents] Marker clicked: ${event.event_id}, currently selected: ${selectedEventId}`);
            setSelectedEventId(currentId => currentId === event.event_id ? null : event.event_id);
          }}
        />
      ))}
       {/* Add a background plane to dismiss the info window when clicking outside */}
       {selectedEventId !== null && (
         <mesh
           position={[0, 0, -1]} // Slightly behind markers
           onClick={(e) => {
             e.stopPropagation();
             console.log('[ThreeLiveUAEvents] Background clicked, deselecting event.');
             setSelectedEventId(null);
           }}
           visible={false} // Invisible plane
         >
           <planeGeometry args={[1e7, 1e7]} /> {/* Large enough plane */}
           <meshBasicMaterial transparent opacity={0} depthWrite={false} />
         </mesh>
       )}
    </group>
  );
};

export default ThreeLiveUAEvents;