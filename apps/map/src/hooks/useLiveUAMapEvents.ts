import { useQuery } from '@tanstack/react-query';

export interface LiveUAMapEvent {
    event_id: number;
    name: string;
    timestamp: string; // ISO date string
    lat: number;
    lng: number;
    source_url?: string | null;
    picture_url?: string | null;
    icon_path?: string | null;
    event_type?: number | null;
    resource?: number | null;
    region_id: number;
    link?: string | null;
    via_source?: string | null;
    video_code?: string | null;
    video_type?: string | null;
    simulation?: number | null; // Assuming simulation is represented by its ID
    simulation_id?: number | null;
    created_at: string; // ISO date string
  }

interface LiveMapEventFilters {
  regionId?: number;
  simulationId?: number;
}

async function fetchLiveUAMapEvents(filters: LiveMapEventFilters): Promise<LiveUAMapEvent[]> {
  const params = new URLSearchParams();
  if (filters.regionId !== undefined) {
    params.append('region_id', filters.regionId.toString());
  }
  if (filters.simulationId !== undefined) {
    params.append('simulation_id', filters.simulationId.toString());
  }

  const response = await fetch(`${import.meta.env['VITE_API_URL']}/api/liveuamap-events/?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Network response was not ok while fetching LiveUAMap events');
  }
  return response.json();
}

export function useLiveUAMapEvents(filters: LiveMapEventFilters = {}) {
  const queryKey = ['liveuamapEvents', filters]; // Query key includes filters

  return useQuery<LiveUAMapEvent[], Error>({
    queryKey: queryKey,
    queryFn: () => fetchLiveUAMapEvents(filters),
    enabled: true, // Fetch immediately
    // Add staleTime or cacheTime if desired
    // staleTime: 1 * 60 * 1000, // 1 minute
  });
}
