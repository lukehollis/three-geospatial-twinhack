// Define entity types
export type EntityType = 'car' | 'pedestrian' | 'bus' | 'firetruck' | 'plane' | 'ship';

// Define position interface
export interface Position {
  lat: number | null;
  lng: number | null;
}
