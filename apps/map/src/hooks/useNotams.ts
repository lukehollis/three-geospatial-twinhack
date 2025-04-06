import { useQuery } from '@tanstack/react-query';

export interface Notam {
    notam_id: string;
    airport: string; // This will be the Airport ICAO string
    airport_icao: string;
    type: string;
    severity: string;
    message: string;
    effective: string; // ISO date string
    expiry: string; // ISO date string
    lat: number;
    lon: number;
    altitude?: number | null;
    is_active: boolean;
    created_at: string; // ISO date string
    updated_at: string; // ISO date string
  }

interface NotamFilters {
  airportIcao?: string;
}

async function fetchNotams(filters: NotamFilters): Promise<Notam[]> {
  const params = new URLSearchParams();
  if (filters.airportIcao) {
    params.append('airport', filters.airportIcao);
  }

  const response = await fetch(`${import.meta.env['VITE_API_URL']}/api/notams/?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Network response was not ok while fetching NOTAMs');
  }
  return response.json();
}

export function useNotams(filters: NotamFilters = {}) {
  const queryKey = ['notams', filters]; // Query key includes filters

  return useQuery<Notam[], Error>({
    queryKey: queryKey,
    queryFn: () => fetchNotams(filters),
    enabled: true, // Fetch immediately
    // Add staleTime or cacheTime if desired
    // staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
