import React, { useEffect, useRef } from 'react';
import { Notmar } from '../hooks/useNotmars'; // Adjust path if needed

interface GoogleMapNotmarsProps {
  map: google.maps.Map;
  notmars: Notmar[];
  show: boolean;
}

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
    // Example: 37°46' 11" N  122°37' 56" W
    // Allows for optional degree symbol (°)
    // Allows for variable whitespace
    const coordRegex = /(\d{1,2}(?:°|\s)\d{1,2}'\s*\d{1,2}(?:\.\d+)?"\s*[NS])\s+(\d{1,3}(?:°|\s)\d{1,2}'\s*\d{1,2}(?:\.\d+)?"\s*[EW])/i;
    const match = message.match(coordRegex);
  
    if (match && match.length >= 3) {
      const latStr = match[1];
      const lonStr = match[2];
      
      const lat = parseDMS(latStr);
      const lng = parseDMS(lonStr);
  
      if (lat !== null && lng !== null) {
        return { lat, lng };
      }
    }
  
    // Add more specific regex patterns if needed for other formats found in the data
    // e.g., for formats like DDMMSSN DDDMMSSW
    const compactRegex = /(\d{6})([NS])\s+(\d{7})([EW])/i;
    const compactMatch = message.match(compactRegex);
    if (compactMatch) {
        const [, latDMS, latDir, lonDMS, lonDir] = compactMatch;
        const lat = (parseFloat(latDMS.substring(0, 2)) + parseFloat(latDMS.substring(2, 4))/60 + parseFloat(latDMS.substring(4, 6))/3600) * (latDir.toUpperCase() === 'S' ? -1 : 1);
        const lng = (parseFloat(lonDMS.substring(0, 3)) + parseFloat(lonDMS.substring(3, 5))/60 + parseFloat(lonDMS.substring(5, 7))/3600) * (lonDir.toUpperCase() === 'W' ? -1 : 1);
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
        }
    }

    // Add RADIUS OF format parsing
    const radiusRegex = /RADIUS\s+OF\s+(\d{6})([NS])(\d{7})([EW])/i; // Example: RADIUS OF 382948N1200717W
    const radiusMatch = message.match(radiusRegex);
    if(radiusMatch) {
        const [, latDMS, latDir, lonDMS, lonDir] = radiusMatch;
        const lat = (parseFloat(latDMS.substring(0, 2)) + parseFloat(latDMS.substring(2, 4))/60 + parseFloat(latDMS.substring(4, 6))/3600) * (latDir.toUpperCase() === 'S' ? -1 : 1);
        const lng = (parseFloat(lonDMS.substring(0, 3)) + parseFloat(lonDMS.substring(3, 5))/60 + parseFloat(lonDMS.substring(5, 7))/3600) * (lonDir.toUpperCase() === 'W' ? -1 : 1);
         if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
        }
    }


    // console.warn(`[GoogleMapNotmars] Could not extract coordinates from message: "${message.substring(0,100)}..."`);
    return null;
  };
  

const GoogleMapNotmars: React.FC<GoogleMapNotmarsProps> = ({ map, notmars, show }) => {
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const clearMarkers = () => {
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  useEffect(() => {
    if (!map || !google.maps.Marker || !google.maps.InfoWindow) {
      console.warn('[GoogleMapNotmars] Map or Google Maps API not ready.');
      return;
    }

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    const infoWindow = infoWindowRef.current;

    clearMarkers();

    if (show) {
        let markersAdded = 0;
        console.log(`[GoogleMapNotmars] Processing ${notmars.length} NOTMARs for coordinates.`);

        notmars.forEach((notmar) => {
        const coords = extractCoordsFromMessage(notmar.message);

        if (coords) {
            if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || isNaN(coords.lat) || isNaN(coords.lng)) {
                console.warn(`[GoogleMapNotmars] Invalid coordinates extracted for NOTMAR ${notmar.id}:`, coords.lat, coords.lng);
                return;
            }

            const markerOptions: google.maps.MarkerOptions = {
            position: coords,
            map: map,
            title: `NOTMAR: ${notmar.notice_number} (Chart ${notmar.chart_number})`,
            };

            try {
            const marker = new google.maps.Marker(markerOptions);
            markersAdded++;

            marker.addListener('click', () => {
                const contentString = `
                <div style="font-family: sans-serif; font-size: 14px; max-width: 400px; padding: 5px;">
                    <strong style="font-size: 16px;">NOTMAR: ${notmar.notice_number} (Chart ${notmar.chart_number})</strong><br>
                    <hr style="margin: 5px 0;">
                    <strong>Action:</strong> ${notmar.notice_action || 'N/A'}<br>
                    <strong>Type:</strong> ${notmar.correction_type || 'N/A'}<br>
                    <strong>Authority:</strong> ${notmar.authority || 'N/A'}<br>
                    ${notmar.edition_number ? `<strong>Edition:</strong> ${notmar.edition_number} (${notmar.edition_date_str || 'N/A'})<br>` : ''}
                    <hr style="margin: 5px 0;">
                    <p style="margin-top: 5px; white-space: normal; max-height: 200px; overflow-y: auto;">${notmar.message}</p>
                </div>
                `;
                infoWindow.setContent(contentString);
                infoWindow.open(map, marker);
            });

            markersRef.current.push(marker);
            } catch (error) {
            console.error(`[GoogleMapNotmars] Error creating marker for NOTMAR ${notmar.id}:`, error, markerOptions);
            }
        }
        });
        console.log(`[GoogleMapNotmars] Added ${markersAdded} markers to map (from ${notmars.length} NOTMARs).`);
    } else {
        console.log('[GoogleMapNotmars] show=false, ensuring no markers are displayed.');
    }

    return () => {
      console.log('[GoogleMapNotmars] Component unmounting, cleaning up markers.');
      clearMarkers();
    };
  }, [map, notmars, show]);

  return null;
};

export default GoogleMapNotmars; 