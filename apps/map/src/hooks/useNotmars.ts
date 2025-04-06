import { useQuery } from '@tanstack/react-query';

export interface Notmar {
    id: number;
    chart_number: string;
    notice_number: string;
    notice_action: string | null;
    correction_type: string | null;
    message: string;
    authority: string | null;
    region: number | null;
    subregion: number | null;
    edition_number: number | null;
    edition_date_str: string | null;
    created_at: string; // ISO date string
    updated_at: string; // ISO date string
  }

interface NotmarFilters {
  chartNumber?: string;
  // Add other potential filters here like noticeNumber, region, etc.
}

async function fetchNotmars(filters: NotmarFilters): Promise<Notmar[]> {
  const params = new URLSearchParams();
  if (filters.chartNumber) {
    params.append('chart_number', filters.chartNumber);
  }
  // Add other filter params here

  const response = await fetch(`${import.meta.env['VITE_API_URL']}/api/notmars/?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Network response was not ok while fetching NOTMARs');
  }
  return response.json();
}

export function useNotmars(filters: NotmarFilters = {}) {
  const queryKey = ['notmars', filters]; // Query key includes filters

  return useQuery<Notmar[], Error>({
    queryKey: queryKey,
    queryFn: () => fetchNotmars(filters),
    enabled: !!filters.chartNumber, // Only fetch if a chartNumber filter is provided, adjust as needed
    // Add staleTime or cacheTime if desired
    // staleTime: 5 * 60 * 1000, // 5 minutes
  });
} 