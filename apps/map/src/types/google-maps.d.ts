declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: Element, opts?: any);
      getCenter(): LatLng;
      setCenter(latLng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
      setOptions(options: any): void;
      panTo(latLng: LatLng | LatLngLiteral): void;
    }
    
    class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      open(map: Map, anchor?: any): void;
      close(): void;
      setContent(content: string | Element): void;
      setPosition(latLng: LatLng | LatLngLiteral): void;
    }
    
    class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
      setPosition(latLng: LatLng | LatLngLiteral): void;
      setIcon(icon: string | Icon | Symbol): void;
      setTitle(title: string): void;
    }
    
    class LatLng {
      constructor(lat: number, lng: number, noWrap?: boolean);
      lat(): number;
      lng(): number;
      toString(): string;
    }
    
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }
    
    interface MarkerOptions {
      position: LatLng | LatLngLiteral;
      map?: Map;
      title?: string;
      icon?: string | Icon | Symbol;
      draggable?: boolean;
    }
    
    interface InfoWindowOptions {
      content?: string | Element;
      position?: LatLng | LatLngLiteral;
      maxWidth?: number;
    }
    
    interface Icon {
      url: string;
      size?: Size;
      scaledSize?: Size;
      origin?: Point;
      anchor?: Point;
    }
    
    class Size {
      constructor(width: number, height: number, widthUnit?: string, heightUnit?: string);
      width: number;
      height: number;
    }
    
    class Point {
      constructor(x: number, y: number);
      x: number;
      y: number;
    }
    
    class Symbol {
      constructor(opts: SymbolOptions);
    }
    
    interface SymbolOptions {
      path: string | SymbolPath;
      fillColor?: string;
      fillOpacity?: number;
      scale?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    }
    
    enum SymbolPath {
      CIRCLE,
      FORWARD_CLOSED_ARROW,
      FORWARD_OPEN_ARROW,
      BACKWARD_CLOSED_ARROW,
      BACKWARD_OPEN_ARROW
    }
    
    // Travel mode types
    type TravelMode = 'BICYCLING' | 'DRIVING' | 'TRANSIT' | 'WALKING';
    
    // Directions API types
    interface DirectionsResult {
      routes: DirectionsRoute[];
      geocoded_waypoints?: DirectionsGeocodedWaypoint[];
    }

    interface DirectionsGeocodedWaypoint {
      geocoder_status: string;
      place_id: string;
      types: string[];
    }

    interface DirectionsRoute {
      bounds: LatLngBounds;
      legs: DirectionsLeg[];
      overview_path: LatLng[];
      overview_polyline: string;
      warnings: string[];
      waypoint_order: number[];
    }
    
    interface DirectionsLeg {
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

    interface DirectionsStep {
      distance: Distance;
      duration: Duration;
      end_location: LatLng;
      instructions: string;
      path: LatLng[];
      start_location: LatLng;
      transit?: TransitDetails;
      travel_mode: TravelMode;
    }

    enum DirectionsStatus {
      INVALID_REQUEST = 'INVALID_REQUEST',
      MAX_WAYPOINTS_EXCEEDED = 'MAX_WAYPOINTS_EXCEEDED',
      NOT_FOUND = 'NOT_FOUND',
      OK = 'OK',
      OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
      REQUEST_DENIED = 'REQUEST_DENIED',
      UNKNOWN_ERROR = 'UNKNOWN_ERROR',
      ZERO_RESULTS = 'ZERO_RESULTS'
    }

    class DirectionsService {
      route(
        request: DirectionsRequest,
        callback: (
          result: DirectionsResult,
          status: DirectionsStatus
        ) => void
      ): void;
    }

    interface DirectionsRequest {
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

    interface DirectionsWaypoint {
      location: string | LatLng | LatLngLiteral | Place;
      stopover?: boolean;
    }
    
    // Distance, Duration, Time interfaces
    interface Distance {
      text: string;
      value: number;
    }

    interface Duration {
      text: string;
      value: number;
    }

    interface Time {
      text: string;
      time_zone: string;
      value: Date;
    }
    
    // Polyline class
    class Polyline extends MVCObject {
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

    interface PolylineOptions {
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
    
    interface IconSequence {
      icon: Symbol;
      offset: string;
      repeat: string;
    }
    
    // Place interface
    interface Place {
      location: LatLng | LatLngLiteral;
      placeId: string;
      query: string;
    }
    
    // UnitSystem enum
    enum UnitSystem {
      IMPERIAL = 0,
      METRIC = 1
    }
    
    // DrivingOptions and TransitOptions interfaces
    interface DrivingOptions {
      departureTime: Date;
      trafficModel?: TrafficModel;
    }
    
    interface TransitOptions {
      arrivalTime?: Date;
      departureTime?: Date;
      modes?: TransitMode[];
      routingPreference?: TransitRoutePreference;
    }
    
    type TrafficModel = 'BEST_GUESS' | 'OPTIMISTIC' | 'PESSIMISTIC';
    type TransitMode = 'BUS' | 'RAIL' | 'SUBWAY' | 'TRAIN' | 'TRAM';
    type TransitRoutePreference = 'FEWER_TRANSFERS' | 'LESS_WALKING';
    
    interface TransitDetails {
      arrival_stop: TransitStop;
      arrival_time: Time;
      departure_stop: TransitStop;
      departure_time: Time;
      headsign: string;
      headway: number;
      line: TransitLine;
      num_stops: number;
    }
    
    interface TransitStop {
      location: LatLng;
      name: string;
    }
    
    interface TransitLine {
      agencies: TransitAgency[];
      color: string;
      icon: string;
      name: string;
      short_name: string;
      text_color: string;
      url: string;
      actor: TransitActor;
    }
    
    interface TransitAgency {
      name: string;
      phone: string;
      url: string;
    }
    
    interface TransitActor {
      icon: string;
      local_icon: string;
      name: string;
      type: ActorType;
    }
    
    type ActorType = 'BUS' | 'CABLE_CAR' | 'COMMUTER_TRAIN' | 'FERRY' | 'FUNICULAR' | 'GONDOLA_LIFT' | 'HEAVY_RAIL' | 'HIGH_SPEED_TRAIN' | 'INTERCITY_BUS' | 'METRO_RAIL' | 'MONORAIL' | 'OTHER' | 'RAIL' | 'SHARE_TAXI' | 'SUBWAY' | 'TRAM' | 'TROLLEYBUS';
    
    // Visualization namespace
    namespace visualization {
      class HeatmapLayer extends MVCObject {
        constructor(opts?: HeatmapLayerOptions);
        getData(): MVCArray<LatLng | WeightedLocation>;
        getMap(): Map;
        setData(data: MVCArray<LatLng | WeightedLocation> | LatLng[] | WeightedLocation[]): void;
        setMap(map: Map | null): void;
        setOptions(options: HeatmapLayerOptions): void;
      }

      interface HeatmapLayerOptions {
        data?: MVCArray<LatLng | WeightedLocation> | LatLng[] | WeightedLocation[];
        dissipating?: boolean;
        gradient?: string[];
        map?: Map;
        maxIntensity?: number;
        opacity?: number;
        radius?: number;
      }

      interface WeightedLocation {
        location: LatLng;
        weight: number;
      }
    }
  }
}
