import React, { useEffect, useRef } from 'react';
import { Notam } from '../hooks/useNotams'; // Adjust path if needed

interface GoogleMapNotamsProps {
  map: google.maps.Map;
  notams: Notam[];
  show: boolean;
}

const GoogleMapNotams: React.FC<GoogleMapNotamsProps> = ({ map, notams, show }) => {
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Function to clear existing markers
  const clearMarkers = () => {
    infoWindowRef.current?.close();
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  useEffect(() => {
    if (!map || !google.maps.Marker || !google.maps.InfoWindow) {
      console.warn('[GoogleMapNotams] Map or Google Maps API not ready.');
      return;
    }

    // Initialize InfoWindow if it doesn't exist
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    const infoWindow = infoWindowRef.current;

    // Clear previous markers before adding new ones
    clearMarkers();

    // Only add markers if show is true
    if (show) {
      console.log(`[GoogleMapNotams] Rendering ${notams.length} NOTAMs.`);

      // Create markers for each NOTAM
      notams.forEach((notam) => {
        // Basic validation for lat/lon
        if (typeof notam.lat !== 'number' || typeof notam.lon !== 'number' || isNaN(notam.lat) || isNaN(notam.lon)) {
          console.warn(`[GoogleMapNotams] Invalid coordinates for NOTAM ${notam.notam_id}:`, notam.lat, notam.lon);
          return; // Skip this marker
        }

        const markerOptions: google.maps.MarkerOptions = {
          position: { lat: notam.lat, lng: notam.lon },
          map: map,
          title: `NOTAM: ${notam.notam_id} (${notam.type})`, // Tooltip
          // Optional: Use a specific icon for NOTAMs
          // icon: {
          //   url: 'path/to/notam-icon.png',
          //   scaledSize: new google.maps.Size(24, 24),
          // },
        };

        try {
          const marker = new google.maps.Marker(markerOptions);

          // Add click listener for InfoWindow
          marker.addListener('click', () => {
            const contentString = `
              <div>
                <strong>NOTAM: ${notam.notam_id} (${notam.airport_icao})</strong><br>
                Type: ${notam.type} | Severity: ${notam.severity}<br>
                Effective: ${new Date(notam.effective).toLocaleString()}<br>
                Expires: ${new Date(notam.expiry).toLocaleString()}<br>
                <p style="max-width: 300px; white-space: normal;">${notam.message}</p>
                ${notam.altitude ? `Altitude: ${notam.altitude} ft<br>` : ''}
              </div>
            `;
            infoWindow.setContent(contentString);
            infoWindow.open(map, marker);
          });

          markersRef.current.push(marker);
        } catch (error) {
          console.error(`[GoogleMapNotams] Error creating marker for NOTAM ${notam.notam_id}:`, error, markerOptions);
        }
      });

      console.log(`[GoogleMapNotams] Added ${markersRef.current.length} markers to map.`);
    } else {
      console.log('[GoogleMapNotams] show=false, ensuring no markers are displayed.');
      // Markers already cleared at the start of the effect
    }

    // Cleanup function still needed for component unmount
    return () => {
      console.log('[GoogleMapNotams] Component unmounting, cleaning up markers.');
      clearMarkers();
    };
  }, [map, notams, show]);

  return null; // No direct DOM rendering
};

export default GoogleMapNotams; 