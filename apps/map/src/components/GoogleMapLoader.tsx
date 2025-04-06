import React, { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { googleMapsApiKeyAtom } from '../helpers/states';
import { atom, useAtom } from 'jotai';

// Create atoms for tracking Google Maps and visualization library loading status
export const googleMapsLoadedAtom = atom(typeof window !== 'undefined' && !!window.google?.maps);
export const visualizationLoadedAtom = atom(typeof window !== 'undefined' && !!window.google?.maps?.visualization);
// Add an atom to track if we're currently loading the API
export const googleMapsLoadingAtom = atom(false);

// Extend Window interface for callback
declare global {
  interface Window {
    google: any;
    googleMapsApiKey?: string;
    initGoogleVisualization?: () => void;
  }
}

interface GoogleMapLoaderProps {
  onLoad?: () => void;
  onError?: (error: string | Error) => void;
}

// Track globally if we've already attempted to load the script
let scriptLoadAttempted = false;

const GoogleMapLoader: React.FC<GoogleMapLoaderProps> = ({ onLoad, onError }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const apiKey = useAtomValue(googleMapsApiKeyAtom);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useAtom(googleMapsLoadedAtom);
  const [visualizationLoaded, setVisualizationLoaded] = useAtom(visualizationLoadedAtom);
  const [isLoading, setIsLoading] = useAtom(googleMapsLoadingAtom);

  useEffect(() => {
    // If the API is already loaded, we don't need to do anything
    if (googleMapsLoaded && visualizationLoaded) {
      console.debug('[GoogleMapLoader] Google Maps API and visualization already available');
      setIsLoaded(true);
      if (onLoad) onLoad();
      return;
    }

    // If we're already loading, don't start another load
    if (isLoading || scriptLoadAttempted) {
      console.debug('[GoogleMapLoader] API is currently loading or load was already attempted');
      return;
    }
    
    // If there's already a script tag, don't add another one
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      console.debug('[GoogleMapLoader] Detected existing Google Maps script tag');
      // Check if the API has loaded
      if (window.google?.maps) {
        console.debug('[GoogleMapLoader] Google Maps API already available');
        setGoogleMapsLoaded(true);
        
        // Check if visualization library is loaded
        if (window.google.maps.visualization) {
          console.debug('[GoogleMapLoader] Visualization library already available');
          setVisualizationLoaded(true);
          setIsLoaded(true);
          if (onLoad) onLoad();
        } else {
          console.warn('[GoogleMapLoader] Maps loaded but visualization library missing');
        }
      } else {
        console.debug('[GoogleMapLoader] Script tag exists but Google Maps not available yet');
      }
      return;
    }
    
    // Check if Google Maps is manually loaded before our component
    if (window.google?.maps) {
      console.debug('[GoogleMapLoader] Google Maps API already available without script tag');
      setGoogleMapsLoaded(true);
      
      if (window.google.maps.visualization) {
        console.debug('[GoogleMapLoader] Visualization library already available');
        setVisualizationLoaded(true);
        setIsLoaded(true);
        if (onLoad) onLoad();
      } else {
        console.warn('[GoogleMapLoader] Maps loaded but visualization library missing');
      }
      return;
    }

    console.debug('[GoogleMapLoader] Loading Google Maps API with visualization library');
    setIsLoading(true);
    scriptLoadAttempted = true;
    
    const loadGoogleMapsWithVisualization = () => {
      try {
        // Double check if a script tag is already loading the API
        if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
          console.debug('[GoogleMapLoader] Another script tag was just added, aborting');
          return;
        }
        
        // Generate a unique callback name to avoid conflicts
        const callbackName = `initGoogleMaps_${Date.now()}`;
        
        // Store API key in window for potential use by other components
        window.googleMapsApiKey = apiKey;
        
        // Define callback function for Google Maps API load
        (window as any)[callbackName] = () => {
          console.debug('[GoogleMapLoader] Google Maps API loaded via callback');
          setGoogleMapsLoaded(true);
          setIsLoading(false);
          
          // Check if visualization library is loaded
          if (window.google?.maps?.visualization) {
            console.debug('[GoogleMapLoader] Visualization library loaded successfully');
            console.log('[GoogleMapLoader] Visualization library object:', window.google.maps.visualization);
            setVisualizationLoaded(true);
          } else {
            console.warn('[GoogleMapLoader] Visualization library not loaded despite being requested');
            console.log('[GoogleMapLoader] Available Google Maps libraries:', window.google?.maps);
          }
          
          setIsLoaded(true);
          if (onLoad) {
            onLoad();
          }
          
          // Clean up the callback
          delete (window as any)[callbackName];
        };
        
        // Create script tag with callback
        const script = document.createElement('script');
        console.log('[GoogleMapLoader] Loading Google Maps with API key and visualization library');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,visualization&callback=${callbackName}`;
        script.async = true;
        script.defer = true;
        script.id = 'google-maps-script';
        
        // Set up error handler only - onload is handled by callback
        script.onerror = () => {
          const loadError = new Error('Failed to load Google Maps API');
          console.error('[GoogleMapLoader]', loadError);
          setError(loadError);
          setIsLoading(false);
          if (onError) {
            onError(loadError);
          }
        };
        
        // Add script to head
        document.head.appendChild(script);
      } catch (e) {
        const initError = e instanceof Error ? e : new Error(String(e));
        console.error('[GoogleMapLoader] Error initializing Google Maps API:', initError);
        setError(initError);
        if (onError) {
          onError(initError);
        }
      }
    };
    
    loadGoogleMapsWithVisualization();
    
    // Cleanup function
    return () => {
      // Nothing to clean up here, the script stays loaded
    };
  }, [apiKey, onLoad, onError, isLoaded, error, isLoading, googleMapsLoaded, visualizationLoaded]);

  // This component doesn't render anything visible
  return null;
};

export default GoogleMapLoader;
