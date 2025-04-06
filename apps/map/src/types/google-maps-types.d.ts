// Type definitions for Google Maps JavaScript API
// These type definitions extend the default Google Maps types to include
// some types that aren't exported in the standard typings

declare namespace google.maps {
  // Symbol and icon related types
  export interface Symbol {
    path: SymbolPath | string;
    fillColor?: string;
    fillOpacity?: number;
    scale?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
  }

  export enum SymbolPath {
    BACKWARD_CLOSED_ARROW = 3,
    BACKWARD_OPEN_ARROW = 4,
    CIRCLE = 0,
    FORWARD_CLOSED_ARROW = 1,
    FORWARD_OPEN_ARROW = 2
  }

  // Travel mode types
  export type TravelMode = 'BICYCLING' | 'DRIVING' | 'TRANSIT' | 'WALKING';

  // Directions API types
  export interface DirectionsResult {
    routes: DirectionsRoute[];
    geocoded_waypoints?: DirectionsGeocodedWaypoint[];
  }

  export interface DirectionsRoute {
    bounds: LatLngBounds;
    legs: DirectionsLeg[];
    overview_path: LatLng[];
    overview_polyline: string;
    warnings: string[];
    waypoint_order: number[];
  }
  
  export interface DirectionsLeg {
    arrival_time?: Time;
    departure_time?: Time;
    distance: Distance;
    duration: Duration;
    duration_in_traffic?: Duration;
    end_address: string;
    end_location: LatLng;
    start_address: string;
    start_location: LatLng;
    steps: DirectionsStep[];
  }

  export interface DirectionsStep {
    distance: Distance;
    duration: Duration;
    end_location: LatLng;
    instructions: string;
    path: LatLng[];
    start_location: LatLng;
    transit?: TransitDetails;
    travel_mode: TravelMode;
  }

  export enum DirectionsStatus {
    INVALID_REQUEST = 'INVALID_REQUEST',
    MAX_WAYPOINTS_EXCEEDED = 'MAX_WAYPOINTS_EXCEEDED',
    NOT_FOUND = 'NOT_FOUND',
    OK = 'OK',
    OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
    REQUEST_DENIED = 'REQUEST_DENIED',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    ZERO_RESULTS = 'ZERO_RESULTS'
  }

  export class DirectionsService {
    route(
      request: DirectionsRequest,
      callback: (
        result: DirectionsResult,
        status: DirectionsStatus
      ) => void
    ): void;
  }

  export interface DirectionsRequest {
    origin: string | LatLng | LatLngLiteral | Place;
    destination: string | LatLng | LatLngLiteral | Place;
    travelMode: TravelMode;
    transitOptions?: TransitOptions;
    drivingOptions?: DrivingOptions;
    unitSystem?: UnitSystem;
    waypoints?: DirectionsWaypoint[];
    optimizeWaypoints?: boolean;
    provideRouteAlternatives?: boolean;
    avoidFerries?: boolean;
    avoidHighways?: boolean;
    avoidTolls?: boolean;
    region?: string;
  }

  export interface DirectionsWaypoint {
    location: string | LatLng | LatLngLiteral | Place;
    stopover?: boolean;
  }

  export class Polyline extends MVCObject {
    constructor(opts?: PolylineOptions);
    getDraggable(): boolean;
    getEditable(): boolean;
    getMap(): Map;
    getPath(): MVCArray<LatLng>;
    getVisible(): boolean;
    setDraggable(draggable: boolean): void;
    setEditable(editable: boolean): void;
    setMap(map: Map | null): void;
    setOptions(options: PolylineOptions): void;
    setPath(path: MVCArray<LatLng> | LatLng[] | LatLngLiteral[]): void;
    setVisible(visible: boolean): void;
  }

  export interface PolylineOptions {
    clickable?: boolean;
    draggable?: boolean;
    editable?: boolean;
    geodesic?: boolean;
    icons?: IconSequence[];
    map?: Map;
    path?: MVCArray<LatLng> | LatLng[] | LatLngLiteral[];
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    visible?: boolean;
    zIndex?: number;
  }

  // Visualization API types
  export namespace visualization {
    export class HeatmapLayer extends MVCObject {
      constructor(opts?: HeatmapLayerOptions);
      getData(): MVCArray<LatLng | WeightedLocation>;
      getMap(): Map;
      setData(data: MVCArray<LatLng | WeightedLocation> | LatLng[] | WeightedLocation[]): void;
      setMap(map: Map | null): void;
      setOptions(options: HeatmapLayerOptions): void;
    }

    export interface HeatmapLayerOptions {
      data?: MVCArray<LatLng | WeightedLocation> | LatLng[] | WeightedLocation[];
      dissipating?: boolean;
      gradient?: string[];
      map?: Map;
      maxIntensity?: number;
      opacity?: number;
      radius?: number;
    }

    export interface WeightedLocation {
      location: LatLng;
      weight: number;
    }
  }
}
