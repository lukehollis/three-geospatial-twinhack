import React, { useEffect, useRef, useState } from 'react';
import { LiveUAMapEvent } from '../hooks/useLiveUAMapEvents';

interface GoogleMapLiveUAEventsProps {
  map: google.maps.Map;
  events: LiveUAMapEvent[];
  show: boolean;
}

const GoogleMapLiveUAEvents: React.FC<GoogleMapLiveUAEventsProps> = ({ map, events, show }) => {
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
      console.warn('[GoogleMapLiveUAEvents] Map or Google Maps API not ready.');
      return;
    }

    // Initialize InfoWindow if it doesn't exist
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    const infoWindow = infoWindowRef.current;

    // Clear previous markers before potentially adding new ones
    clearMarkers();

    // Only add markers if show is true
    if (show) {
      console.log(`[GoogleMapLiveUAEvents] Rendering ${events.length} events.`);
      // Log map center and zoom when attempting to render markers
      console.log('[GoogleMapLiveUAEvents] Map Center:', map.getCenter()?.toJSON(), 'Zoom:', map.getZoom());

      // Create markers for each event
      events.forEach((event, index) => {
        // Log coordinates for each event

        // Basic validation
        if (typeof event.lat !== 'number' || typeof event.lng !== 'number' || isNaN(event.lat) || isNaN(event.lng)) {
          console.warn(`[GoogleMapLiveUAEvents] Invalid coordinates for event ${event.event_id}:`, event.lat, event.lng);
          return; // Skip this marker
        }

        const markerOptions: google.maps.MarkerOptions = {
          position: { lat: event.lat, lng: event.lng },
          map: map,
          title: event.name.substring(0, 100), // Tooltip on hover
        };

        // *** TEMPORARILY DISABLED CUSTOM ICON ***
        // if (event.icon_path) {
        //   console.log(`[GoogleMapLiveUAEvents] Using custom icon: ${event.icon_path}`);
        //   markerOptions.icon = {
        //     url: event.icon_path,
        //     scaledSize: new google.maps.Size(24, 24),
        //     anchor: new google.maps.Point(12, 12),
        //   };
        // }

        try {
          const marker = new google.maps.Marker(markerOptions);

          // Add click listener for InfoWindow
          marker.addListener('click', () => {
            const contentString = `
              <div>
                <strong>${event.name}</strong><br>
                Time: ${new Date(event.timestamp).toLocaleString()}<br>
                ${event.link ? `<a href="${event.link}" target="_blank" rel="noopener noreferrer">View Source</a>` : ''}
              </div>
            `;
            infoWindow.setContent(contentString);
            infoWindow.open(map, marker);
          });

          markersRef.current.push(marker);
        } catch (error) {
          console.error(`[GoogleMapLiveUAEvents] Error creating marker for event ${event.event_id}:`, error, markerOptions);
        }
      });

      console.log(`[GoogleMapLiveUAEvents] Added ${markersRef.current.length} markers to map.`);
    } else {
      console.log('[GoogleMapLiveUAEvents] show=false, ensuring no markers are displayed.');
      // Markers already cleared at the start of the effect
    }

    // Cleanup function still needed for component unmount
    return () => {
      console.log('[GoogleMapLiveUAEvents] Component unmounting, cleaning up markers.');
      clearMarkers();
    };
  }, [map, events, show]);

  return null; // This component doesn't render any DOM elements itself
};

export default GoogleMapLiveUAEvents;
