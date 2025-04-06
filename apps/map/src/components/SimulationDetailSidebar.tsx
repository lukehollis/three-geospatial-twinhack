import React, { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react';
import { useAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { Card, Button, Slider, InputGroup, ButtonGroup, Intent, Collapse } from '@blueprintjs/core';
import { 
  simulationService,
  Simulation,
  Actor,
  PlaybackState
} from '../services/SimulationService';
import ActorListItem from './ActorListItem';
import SimulationAnalysis from './SimulationAnalysis';

interface SimulationDetailSidebarProps {
  simulation?: Simulation | null;
  playbackState?: PlaybackState;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onSpeedChange?: (speed: number) => void;
}

const SimulationDetailSidebar: React.FC<SimulationDetailSidebarProps> = ({
  simulation,
  playbackState,
  onPlay,
  onPause,
  onStop,
  onSpeedChange
}) => {
  // Get simulation data from props or service
  const [currentSimulation, setCurrentSimulation] = useState<Simulation | null>(
    simulation || simulationService.getSimulation()
  );
  const [currentPlayback, setCurrentPlayback] = useState<PlaybackState>(
    playbackState || simulationService.getPlaybackState()
  );
  
  // Local UI state
  const [simulationName, setSimulationName] = useState('');
  const [actorListVisible, setActorListVisible] = useState(true);
  
  // Create ref for throttling debug logs
  const lastLogTimeRef = useRef(0);
  
  // Add query client to invalidate queries
  const queryClient = useQueryClient();

  const navigate = useNavigate();
  
  // Subscribe to simulation changes if not provided via props
  useEffect(() => {
    if (!simulation || !playbackState) {
      const unsubscribe = simulationService.subscribe(() => {
        setCurrentSimulation(simulationService.getSimulation());
        setCurrentPlayback(simulationService.getPlaybackState());
      });
      
      return unsubscribe;
    }
  }, [simulation, playbackState]);
  
  // Update local state when props change
  useEffect(() => {
    if (simulation) {
      setCurrentSimulation(simulation);
    }
    if (playbackState) {
      setCurrentPlayback(playbackState);
    }
  }, [simulation, playbackState]);
  
  // Debug logging - limit to avoid extra renders
  useEffect(() => {
    const now = Date.now();
    
    // Only log if it's been at least 1 second since the last log
    if (now - lastLogTimeRef.current > 1000) {
      console.log('[SimulationDetailSidebar] Current simulation:', currentSimulation);
      console.log('[SimulationDetailSidebar] Current playback state:', currentPlayback);
      console.log('[SimulationDetailSidebar] Actors count:', currentSimulation?.actors?.length || 0);
      console.log('[SimulationDetailSidebar] Component received update at:', new Date().toISOString());
      
      lastLogTimeRef.current = now;
    }
  }, [currentSimulation, currentPlayback]);
  
  // Handle play/pause functionality
  const handlePlayPause = () => {
    if (onPlay && onPause) {
      if (currentPlayback.isPlaying) {
        onPause();
      } else {
        onPlay();
      }
    } else {
      if (currentPlayback.isPlaying) {
        simulationService.pause();
      } else {
        simulationService.play();
      }
    }
  };
  
  // Handle reset functionality
  const handleReset = () => {
    if (onStop) {
      onStop();
    } else {
      simulationService.resetSimulation();
    }
  };
  
  // Handle speed change
  const handleSpeedChange = (value: number) => {
    if (onSpeedChange) {
      onSpeedChange(value);
    } else {
      simulationService.setSpeed(value);
    }
  };
  
  // Handle actor updates
  const handleActorUpdate = (updatedActor: Actor) => {
    // In the new approach, we don't directly modify actors here
    // Instead, we would need to update the simulation via the service
    console.log('[SimulationDetailSidebar] Actor update requested - not implemented in new service model');
  };
  
  // Handle deleting an actor
  const handleDeleteActor = (actorId: string) => {
    // Not directly modifying state here - would need a service method
    console.log('[SimulationDetailSidebar] Actor deletion requested - not implemented in new service model');
  };
  
  // For deleting the entire simulation
  const handleDeleteSimulation = async () => {
    if (!currentSimulation?.id) {
      console.warn('[SimulationDetailSidebar] Cannot delete simulation without ID');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this simulation? This action cannot be undone.')) {
      try {
        console.log(`[SimulationDetailSidebar] Deleting simulation ${currentSimulation.id}`);
        
        // Call the API to delete the simulation
        const success = await simulationService.deleteSingleSimulation(currentSimulation.id);
        
        if (success) {
          // Clear the simulation locally
          simulationService.setSimulation(null);
          
          // Clear simulation name
          setSimulationName('');
          
          // Invalidate the simulations query to update the sidebar list
          queryClient.invalidateQueries({ queryKey: ['simulations'] });
          
          // Show the chat interface again
          console.log('[SimulationDetailSidebar] Showing chat interface because simulation was deleted');
          window.dispatchEvent(new CustomEvent('show-chat-interface'));

          navigate('/');
        } else {
          console.error('[SimulationDetailSidebar] Failed to delete simulation');
          alert('Failed to delete simulation. Please try again.');
        }
      } catch (error) {
        console.error('[SimulationDetailSidebar] Error deleting simulation:', error);
        alert('An error occurred while deleting the simulation.');
      }
    }
  };
  
  // Set simulation name from loaded simulation
  useEffect(() => {
    if (currentSimulation?.name && !simulationName) {
      setSimulationName(currentSimulation.name);
    }
  }, [currentSimulation, simulationName]);

  return (
    <div css={controlsContainerStyle}>
      <div css={controlsCardStyle}>
        <div css={combinedControlsStyle}>
          <div css={simulationNameContainerStyle}>
            <InputGroup
              placeholder="Enter simulation name"
              value={simulationName}
              onChange={(e) => {
                const newName = e.target.value;
                setSimulationName(newName);
                setGlobalSimulationName(newName);
              }}
              css={simulationNameInputStyle}
              rightElement={
                <div css={simulationNameRightElementStyle}>
                  {/* Debug button to force reload simulation */}
                  <Button
                    icon="refresh"
                    minimal={true}
                    intent="none"
                    onClick={() => {
                      console.log('[SimulationDetailSidebar] Force reloading simulation');
                      if ((window as any).manuallyLoadSimulation) {
                        (window as any).manuallyLoadSimulation()
                          .then(() => {
                            console.log('[SimulationDetailSidebar] Manual load complete');
                          });
                      }
                    }}
                    css={{ marginRight: 4 }}
                    title="Debug: Force reload simulation"
                  />
                  <Button
                    icon="trash"
                    minimal={true}
                    intent="danger"
                    onClick={handleDeleteSimulation}
                    title="Delete simulation"
                  />
                </div>
              }
            />
          </div>
          
          <div css={controlButtonsContainerStyle}>
            <ButtonGroup css={controlButtonsStyle}>
              <Button 
                icon={currentPlayback.isPlaying ? "pause" : "play"} 
                intent={Intent.PRIMARY}
                onClick={handlePlayPause}
                css={playButtonStyle}
              />
              <Button 
                icon="reset" 
                onClick={handleReset}
                css={resetButtonStyle}
              />
            </ButtonGroup>
            
            <div css={speedSliderContainerStyle}>
              <Slider 
                min={0.1} 
                max={5} 
                stepSize={0.1} 
                labelStepSize={1}
                value={currentPlayback.speedMultiplier} 
                onChange={handleSpeedChange}
                labelRenderer={value => `${value}x`}
              />
            </div>
          </div>
        </div>
        
        <div css={accordionHeaderStyle}>
          <h3 css={accordionTitleStyle}>Actors</h3>
          <Button
            icon={actorListVisible ? "caret-up" : "caret-down"}
            minimal={true}
            onClick={() => setActorListVisible(!actorListVisible)}
            css={toggleActorListButtonStyle}
          />
        </div>
        
        <Collapse isOpen={actorListVisible} css={collapseStyle}>
          <div css={actorListStyle}>
            {currentSimulation?.actors && Array.isArray(currentSimulation.actors) && currentSimulation.actors.length > 0 ? (
              currentSimulation.actors.map((actor, index) => {
                if (!actor) {
                  console.error('[SimulationDetailSidebar] Null actor at index', index);
                  return null;
                }
                return (
                  <ActorListItem 
                    key={actor.id || `actor-${index}`} 
                    actor={actor} 
                    onActorUpdate={handleActorUpdate}
                    onDelete={handleDeleteActor}
                  />
                );
              })
            ) : (
              <div css={noActorsStyle}>
                <p>No actors in the simulation.</p>
                <p>Try entering a prompt to create a simulation.</p>
                
                {/* Debug info */}
                <div css={debugInfoStyle}>
                  <h4>Debug Info:</h4>
                  <p>Current Playback: {JSON.stringify({
                    isPlaying: currentPlayback.isPlaying,
                    isPaused: currentPlayback.isPaused,
                    speedMultiplier: currentPlayback.speedMultiplier
                  })}</p>
                  <p>Actor Count: {currentSimulation?.actors?.length || 0}</p>
                  <p>Global Name: {globalSimulationName || "(none)"}</p>
                  <p>Local Name: {simulationName || "(none)"}</p>
                  <div css={debugButtonsStyle}>
                    <button onClick={() => { 
                      console.log("Current Simulation:", currentSimulation); 
                      console.log("Current Playback:", currentPlayback);
                    }}>Log State</button>
                    
                    <button onClick={() => {
                      if ((window as any).manuallyLoadSimulation) {
                        console.log('[SimulationDetailSidebar] Calling React Query refresh');
                        (window as any).manuallyLoadSimulation();
                      } else {
                        console.log('[SimulationDetailSidebar] Load function not available');
                      }
                    }}>Load From API</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Collapse>

        <div css={simulationAnalysisContainerStyle}>
          <SimulationAnalysis />
        </div>
      </div>
    </div>
  );
};

// Styles
const controlsContainerStyle = css`
  position: fixed;
  top: 0px;
  left: 0px;
  z-index: 999;
  pointer-events: auto;
  width: 420px;
  height: 100vh;
  overflow-y: scroll;

  background-color: rgba(0,0,0, 0.8);
  backdrop-filter: blur(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding-bottom: 120px;
`;

const controlsCardStyle = css`
  width: 420px;
  padding-left: 60px;
  padding-top: 24px;
  padding-right: 16px;
  height: 100vh;
  color: white;
`;

const combinedControlsStyle = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
`;

const simulationNameContainerStyle = css`
  flex-grow: 1;
  min-width: 100px;
  width: 100%;
`;

const simulationNameInputStyle = css`
  color: white;

  
  input {
    color: white;
    background-color: rgba(40, 45, 50, 0.7);
    font-size: 16px;
    padding: 8px 12px;
    display: block;
    height: auto;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

const simulationNameRightElementStyle = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  height: 46px;
  padding-right: 8px;
`;

const controlButtonsContainerStyle = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin: 16px 0;
`;

const controlButtonsStyle = css`
  display: flex;
  gap: 8px;
`;

const playButtonStyle = css`
  min-width: 32px;
  min-height: 32px;
  background: white !important;
  border-radius: 50% !important;
  color: black !important;
  
  &:hover {
    background: #f0f0f0 !important;
  }
  
  svg {
    color: black !important;
    fill: black !important;
  }
  
  &:disabled {
    opacity: 0.5;
    background: #e0e0e0 !important;
  }
`;

const resetButtonStyle = css`
  background: rgba(0, 0, 0, 0.7) !important;
  border-radius: 50% !important;
  color: white !important;
  
  &:hover {
    background: rgba(0, 0, 0, 0.9) !important;
  }
  
  svg {
    color: white !important;
    fill: white !important;
    width: 12px !important;
    height: 12px !important;
  }
  
  &:disabled {
    opacity: 0.5;
  }
`;


const speedSliderContainerStyle = css`
  margin: 0 8px;
`;

const toggleActorListButtonStyle = css`
  margin-left: auto;
`;

const actorListStyle = css`
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(30, 35, 40, 0.5);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(60, 65, 70, 0.8);
    border-radius: 4px;
  }
`;

const noActorsStyle = css`
  padding: 16px;
  text-align: center;
`;

const debugInfoStyle = css`
  margin-top: 12px;
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  width: 100%;
`;

const debugButtonsStyle = css`
  margin-top: 8px;
  display: flex;
  gap: 8px;
`;

const accordionHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  background-color: rgba(40, 45, 50, 0.7);
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
`;

const accordionTitleStyle = css`
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 600;
  padding-left: 12px;
`;

const collapseStyle = css`
  margin-bottom: 12px;
`;

const simulationAnalysisContainerStyle = css`
  margin-top: 12px;
  overflow-y: scroll;
`;

export default SimulationDetailSidebar;
