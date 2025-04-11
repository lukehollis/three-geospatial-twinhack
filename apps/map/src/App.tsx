import { useEffect } from 'react';
import { Provider } from 'jotai';
import { css } from '@emotion/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Routes, Route, Navigate, useParams } from 'react-router';
import SimulationContainer from './SimulationContainer';
import InfoPanel from './components/InfoPanel';
import { QueryClient } from '@tanstack/react-query';
import { SimulationService } from './services/SimulationService';
import { useSimulations } from './hooks/useSimulations';
import { useSimulation } from './hooks/useSimulation';
import { Spinner } from '@blueprintjs/core';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const loadingModalStyle = css`
  position: fixed;
  top: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.2);
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
`;

const LoadingModal = () => {
  return (
    <div css={loadingModalStyle}>
      <Spinner />
    </div>
  );
};

// Combined view for both routes
function MainView({ isLoading, error }: { isLoading: boolean, error: Error | null }) {
  return (
    <div className="root-container">
      {isLoading && <LoadingModal />}
      {error && <div>Error: {error.message}</div>}
      <SimulationContainer 
        dayOfYear={170}
        timeOfDay={7.5}
        exposure={10}
        longitude={-122.3866}
        latitude={37.7578}
        heading={90}
        pitch={-90}
        distance={14000}
        coverage={0.35}
      />
      <InfoPanel />
    </div>
  );
}

// A component that loads a specific simulation and then renders MainView
function SimulationLoader() {
  const { id } = useParams<{ id: string }>();
  const { isLoading, error } = useSimulation();
  
  return <MainView isLoading={isLoading} error={error} />;
}

function AppInitializer() {
  // This properly calls the hook
  useSimulations();
  
  useEffect(() => {
    new SimulationService().generateUserIdIfNeeded();
  }, []);
  
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider>
        <AppInitializer />
        <Routes>
          <Route path="/" element={<MainView />} />
          <Route path="/sim/:id/:slug" element={<SimulationLoader />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Provider>
      {/* Add React Query Devtools - only in development */}
      {import.meta.env['VITE_DEBUG_MODE'] === 'true' && 
        <ReactQueryDevtools 
          initialIsOpen={false} 
        />
      }
    </QueryClientProvider>
  );
}

export default App;
