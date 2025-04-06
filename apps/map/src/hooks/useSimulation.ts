// src/hooks/useSimulation.ts
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { simulationService, Simulation } from '../services/SimulationService';

export function useSimulation() {
  const { id } = useParams<{ id: string }>();
  
  // Query for simulation details
  const query = useQuery<Simulation | null, Error>({
    queryKey: ['simulation', id],
    queryFn: async () => {
      if (!id) throw new Error('No simulation ID provided');
      console.log('[useSimulation] Loading simulation:', id);
      const data = await simulationService.loadSimulation(id);
      return data;
    },
    enabled: !!id
  });
  
  // Update global state when data is loaded
  useEffect(() => {
    if (!query.data) return;
    
    console.log('[useSimulation] Updating state with loaded simulation:', query.data);
    
    // Set the simulation in the service
    simulationService.setSimulation(query.data);
    console.log('[useSimulation] Simulation set in service:', query.data);

    // Hide chat interface as soon as simulation data is available
    window.dispatchEvent(new Event('hide-chat-interface'));
    
    // Focus map on first actor's destination if available
    if (query.data.actors && query.data.actors.length > 0) {
      const firstActor = query.data.actors[0];

      // Check if destinations exist and have at least one entry
      if (firstActor.destinations && firstActor.destinations.length > 0) {
        // Access coordinates correctly from the nested 'position' object
        const firstDestination = firstActor.destinations[0];
        console.log('[useSimulation] First destination:', firstDestination);
        console.log('[useSimulation] First destination:', firstDestination);
        console.log('[useSimulation] First destination:', firstDestination);
        console.log('[useSimulation] First destination:', firstDestination);
        console.log('[useSimulation] First destination:', firstDestination);
        console.log('[useSimulation] First destination:', firstDestination);
        console.log('[useSimulation] First destination:', firstDestination);
        if (firstDestination) {
             const { lat: latitude, lng: longitude } = firstDestination;
             // TODO: Use latitude and longitude to focus the map
             console.log(`[useSimulation] Focusing on first actor's destination: ${latitude}, ${longitude}`);
        } else {
             console.warn('[useSimulation] First destination exists but has no position data.');
        }

        // This event is now dispatched earlier
        // window.dispatchEvent(new Event('hide-chat-interface')); 
      } else {
        console.log('[useSimulation] First actor found, but no destinations assigned yet.');
      }
    }
    
    // Store simulation ID for other components
    (window as any).latestSimulationId = id;
    
    // Dispatch event to ensure UI updates
    window.dispatchEvent(new CustomEvent('force-ui-update'));
  }, [query.data, id]);

  return query;
}