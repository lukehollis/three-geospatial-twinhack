import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { simulationService } from '../services/SimulationService';

// Directly use the return type from the service method
type SimulationListResult = Awaited<ReturnType<typeof simulationService.listUserSimulations>>;

export function useSimulations(): UseQueryResult<SimulationListResult, Error> {

  return useQuery({
    queryKey: ['simulations'],
    queryFn: async () => {
      const result = await simulationService.listUserSimulations();
      return result;
    },
    staleTime: 60000, // 1 minute
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}