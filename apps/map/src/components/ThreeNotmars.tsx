import React, { useState, useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { Billboard, Circle, Html, Text, Ring } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Geodetic } from '@takram/three-geospatial';
import { useNotmars, Notmar } from '../hooks/useNotmars'; // Import hook and type for NOTMARs
import { showRealtimeDataAtom } from '../helpers/states'; // Import the atom for visibility

// --- Coordinate Parsing Logic (copied from GoogleMapNotmars) ---

// Helper function to parse DMS format (e.g., 37°46' 11" N or 122°37' 56" W)
const parseDMS = (dmsString: string): number | null => {
  const parts = dmsString.match(/(\d+)(?:°|\s)(\d+)'\s*(\d+(?:\.\d+)?)"\s*([NSEW])/i);
  if (!parts) return null;

  const [, degrees, minutes, seconds, direction] = parts;
  let decimalDegrees = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / 3600;

  if (direction === 'S' || direction === 'W') {
    decimalDegrees = -decimalDegrees;
  }

  return decimalDegrees;
};

// Helper function to find coordinates in the message text
const extractCoordsFromMessage = (message: string): { lat: number; lng: number } | null => {
    // Regex to find patterns like DD°MM' SS" N/S/E/W or DDD°MM' SS" W
    const coordRegex = /(\d{1,2}(?:°|\s)\d{1,2}'\s*\d{1,2}(?:\.\d+)?"\s*[NS])\s+(\d{1,3}(?:°|\s)\d{1,2}'\s*\d{1,2}(?:\.\d+)?"\s*[EW])/i;
    const match = message.match(coordRegex);

    if (match && match.length >= 3) {
      const latStr = match[1];
      const lonStr = match[2];
      const lat = parseDMS(latStr);
      const lng = parseDMS(lonStr);
      if (lat !== null && lng !== null) return { lat, lng };
    }

    // Compact format DDMMSSN DDDMMSSW
    const compactRegex = /(\d{6})([NS])\s+(\d{7})([EW])/i;
    const compactMatch = message.match(compactRegex);
    if (compactMatch) {
        const [, latDMS, latDir, lonDMS, lonDir] = compactMatch;
        const lat = (parseFloat(latDMS.substring(0, 2)) + parseFloat(latDMS.substring(2, 4))/60 + parseFloat(latDMS.substring(4, 6))/3600) * (latDir.toUpperCase() === 'S' ? -1 : 1);
        const lng = (parseFloat(lonDMS.substring(0, 3)) + parseFloat(lonDMS.substring(3, 5))/60 + parseFloat(lonDMS.substring(5, 7))/3600) * (lonDir.toUpperCase() === 'W' ? -1 : 1);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    // RADIUS OF format
    const radiusRegex = /RADIUS\s+OF\s+(\d{6})([NS])(\d{7})([EW])/i;
    const radiusMatch = message.match(radiusRegex);
    if(radiusMatch) {
        const [, latDMS, latDir, lonDMS, lonDir] = radiusMatch;
        const lat = (parseFloat(latDMS.substring(0, 2)) + parseFloat(latDMS.substring(2, 4))/60 + parseFloat(latDMS.substring(4, 6))/3600) * (latDir.toUpperCase() === 'S' ? -1 : 1);
        const lng = (parseFloat(lonDMS.substring(0, 3)) + parseFloat(lonDMS.substring(3, 5))/60 + parseFloat(lonDMS.substring(5, 7))/3600) * (lonDir.toUpperCase() === 'W' ? -1 : 1);
         if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    // console.warn(`[ThreeNotmars] Could not extract coordinates from message: "${message.substring(0,100)}..."`);
    return null;
  };

// --- End Coordinate Parsing Logic ---


interface NotmarMarkerProps {
  notmar: Notmar;
  positionVec: THREE.Vector3; // Pass the calculated position
  onClick: () => void;
  isSelected: boolean;
}

// Style constants (can be adjusted for NOTMARs)
const MARKER_COLOR = '#FF8C00'; // DarkOrange color for NOTMAR center
const RING_COLOR = '#FFFFFF'; // white color for ring
const OUTER_RING_COLOR = '#000000'; // black color for outer ring
const MARKER_SIZE = 160; // Adjust size as needed
const INFO_BOX_STYLE: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.8)',
  color: 'white',
  padding: '12px 15px',
  borderRadius: '5px',
  fontSize: '14px',
  minWidth: '360px',
  maxWidth: '420px',
  pointerEvents: 'auto',
  whiteSpace: 'pre-wrap',
  textAlign: 'left',
  // For scrollable message content
  overflow: 'hidden', // Hide overflow on the main div
};

const INFO_BOX_MESSAGE_STYLE: React.CSSProperties = {
    maxHeight: '200px', // Limit message height
    overflowY: 'auto', // Enable vertical scroll
    marginTop: '5px',
    paddingRight: '10px', // Add padding to prevent scrollbar overlap
    whiteSpace: 'normal', // Allow wrapping
};


const NotmarMarker: React.FC<NotmarMarkerProps> = ({ notmar, positionVec, onClick, isSelected }) => {
  const { camera } = useThree();
  const [isHovered, setIsHovered] = useState(false);

  // Position is pre-calculated and passed as prop
  const position = positionVec;

  return (
    <Billboard position={position}>
      {/* Marker Rings and Circle */}
      <Ring
          args={[MARKER_SIZE, MARKER_SIZE + 64, 32]} // inner, outer, segments
          material-color={OUTER_RING_COLOR}
          material-transparent={true}
          material-opacity={0.9}
          material-side={THREE.DoubleSide}
      />
      <Ring
          args={[MARKER_SIZE, MARKER_SIZE + 60, 32]} // inner, outer, segments
          material-color={RING_COLOR}
          material-transparent={true}
          material-opacity={1}
          material-side={THREE.DoubleSide}
      />
      <Circle
        args={[MARKER_SIZE, 32]} // radius, segments
        onClick={(e) => {
            e.stopPropagation();
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
        material-color={isHovered ? 'orange' : MARKER_COLOR} // Hover color change
        material-transparent={true}
        material-opacity={0.9}
        material-side={THREE.DoubleSide}
      />

      {/* Info Box */}
      {isSelected && (
        <Html
          position={[0, MARKER_SIZE * 1.5, 0]}
          center
          transform={false} // Keep fixed screen size
          occlude
          zIndexRange={[100, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div style={INFO_BOX_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0 5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick(); // Call parent onClick to close
                }}
              >
                Close
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="currentColor"><title>close</title><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" /></svg>
              </button>
            </div>
            <strong style={{ fontSize: '16px' }}>NOTMAR: {notmar.notice_number} (Chart {notmar.chart_number})</strong>
            <hr style={{ margin: '5px 0', borderColor: 'rgba(255,255,255,0.3)' }}/>
            <p style={{ fontSize: '12px', margin: '5px 0' }}>
                <strong>Action:</strong> {notmar.notice_action || 'N/A'} |
                <strong>Type:</strong> {notmar.correction_type || 'N/A'} |
                <strong>Authority:</strong> {notmar.authority || 'N/A'}
                {notmar.edition_number && ` | Edition: ${notmar.edition_number} (${notmar.edition_date_str || 'N/A'})`}
            </p>
             <hr style={{ margin: '5px 0', borderColor: 'rgba(255,255,255,0.3)' }}/>
            <div style={INFO_BOX_MESSAGE_STYLE}>
                 <p style={{ margin: 0 }}>{notmar.message}</p>
            </div>
          </div>
        </Html>
      )}
    </Billboard>
  );
};


const ThreeNotmars: React.FC = () => {
  // --- Hooks (called unconditionally first) ---
  const showRealtime = useAtomValue(showRealtimeDataAtom);
  const { data: notmars, isLoading, error } = useNotmars({ chartNumber: '18645' });
  const [selectedNotmarId, setSelectedNotmarId] = useState<number | null>(null);

  // --- Restore original useMemo logic ---
  const notmarsWithPositions = useMemo(() => {
    // Log the input to useMemo
    // console.log('[ThreeNotmars] useMemo running. Input notmars:', notmars);

    // Handle the case where notmars data isn't available yet
    if (!notmars) return [];

    const processed = notmars
      .map(notmar => {
        const coords = extractCoordsFromMessage(notmar.message);
        if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' && !isNaN(coords.lat) && !isNaN(coords.lng)) {
          const geodetic = new Geodetic(
            THREE.MathUtils.degToRad(coords.lng),
            THREE.MathUtils.degToRad(coords.lat),
            100 // Altitude offset
          );
          return { notmar, positionVec: geodetic.toECEF() };
        }
        // Log if coordinates couldn't be extracted for a specific NOTMAR
        // console.warn(`[ThreeNotmars] Could not extract coords for NOTMAR ID ${notmar.id}`);
        return null;
      })
      .filter(item => item !== null) as { notmar: Notmar; positionVec: THREE.Vector3 }[];

    // Log the output of useMemo
    // console.log('[ThreeNotmars] useMemo finished. Output count:', processed.length);
    return processed;
  }, [notmars]); // Dependency remains notmars


  // --- Conditional Rendering (AFTER hooks) ---
  if (!showRealtime) {
    // console.log('[ThreeNotmars] Returning null because showRealtime is false.');
    return null;
  }
  if (isLoading) {
    // console.log('[ThreeNotmars] Returning null because isLoading is true.');
    return null; // Or a loading indicator
  }
  if (error) {
    console.error('[ThreeNotmars] Error fetching NOTMARs:', error);
    return null; // Or an error component
  }
  // This condition now correctly uses the calculated notmarsWithPositions
  if (notmarsWithPositions.length === 0) {
    // This might log initially if useNotmars hasn't returned data yet, or if no coords are found
    // console.log('[ThreeNotmars] Returning null because notmarsWithPositions is empty.');
    return null;
  }

  // --- Render logic ---
  // console.log('[ThreeNotmars] Rendering markers. Count:', notmarsWithPositions.length);
  return (
    <group>
      {notmarsWithPositions.map(({ notmar, positionVec }) => (
        <NotmarMarker
          key={notmar.id}
          notmar={notmar}
          positionVec={positionVec}
          isSelected={selectedNotmarId === notmar.id}
          onClick={() => {
            // console.log(`[ThreeNotmars] Marker clicked: ${notmar.id}, currently selected: ${selectedNotmarId}`);
            setSelectedNotmarId(currentId => currentId === notmar.id ? null : notmar.id);
          }}
        />
      ))}
      {/* Background plane */}
      {selectedNotmarId !== null && (
        <mesh
          position={[0, 0, -1]}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNotmarId(null);
          }}
          visible={false}
        >
          <planeGeometry args={[1e7, 1e7]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

export default ThreeNotmars;

// new component for notmars