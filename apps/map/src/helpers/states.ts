import { atom, type SetStateAction } from 'jotai'

// Load Google Maps API key from environment variables
export const googleMapsApiKeyAtom = atom(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '')

export const needsApiKeyPrimitiveAtom = atom(false)
export const needsApiKeyAtom = atom(
  get => get(needsApiKeyPrimitiveAtom) && get(googleMapsApiKeyAtom) === '',
  (get, set, value: SetStateAction<boolean>) => {
    set(needsApiKeyPrimitiveAtom, value)
  }
)

// Create an atom to track the map view mode (2D or 3D)
export const mapViewModeAtom = atom<'2D' | '3D'>('3D')

// Define the interface for map focus location
export interface MapFocusLocation {
  latitude: number;
  longitude: number;
  name?: string;
  pitch?: number;    // Camera pitch angle in degrees
  distance?: number; // Camera distance from the focus point
  heading?: number;  // Camera heading angle in degrees
}

const default_distance = 14000;
const far_distance_for_star_debugging = 10000000;

// Default map focus location (San Francisco)
export const mapFocusLocationAtom = atom<MapFocusLocation>({
  latitude: 37.7939119,
  longitude: -122.4027251,
  name: 'San Francisco',
  distance: default_distance, 
})

// Atom to control the visibility of realtime event layers
export const showRealtimeDataAtom = atom<boolean>(true); // Default to true


export const teamWinAtom = atom<string>('');