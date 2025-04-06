import React, { useEffect } from 'react';
import { css } from '@emotion/react';
import { Button, Card, H4, Spinner, Intent, Callout, Dialog, Classes } from '@blueprintjs/core';
import { useNavigate } from 'react-router';

import { useSimulations } from '../hooks/useSimulations';
import { simulationService } from '../services/SimulationService';

interface SimulationListSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const SimulationListSidebar: React.FC<SimulationListSidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [simulationToDelete, setSimulationToDelete] = React.useState<string | null>(null);
  
  // Call the hook unconditionally
  const { data: simulations = [], isLoading, isError, error, refetch } = useSimulations();
  
  const handleSimulationClick = ({id, slug}: {id: string, slug: string}) => {
    // Navigate to the simulation-specific route
    navigate(`/sim/${id}/${slug}`);
    
    // Hide the sidebar
    onClose();
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent card click from triggering
    setSimulationToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!simulationToDelete) return;
    
    try {
      const success = await simulationService.deleteSingleSimulation(simulationToDelete);
      if (success) {
        refetch(); // Refresh the list after deletion
      }
    } catch (error) {
      console.error('[SimulationListSidebar] Error deleting simulation:', error);
    } finally {
      setSimulationToDelete(null); // Close dialog
    }
  };

  if (!isOpen) return null;

  return (
    <div css={sidebarContainerStyle}>
      <div css={sidebarContentStyle}>
        
        {isLoading ? (
          <div css={loadingContainerStyle}>
            <Spinner size={24} />
            <p>Loading simulations...</p>
          </div>
        ) : isError ? (
          <Callout 
            intent={Intent.DANGER} 
            title="Error loading simulations"
            icon="error"
            css={errorContainerStyle}
          >
            <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button 
              intent={Intent.PRIMARY} 
              small 
              onClick={() => refetch()}
              icon="refresh"
            >
              Try Again
            </Button>
          </Callout>
        ) : simulations.length === 0 ? (
          <div css={emptyStateStyle}>
            <p>No simulations found.</p>
            <p>Create a simulation by entering a prompt in the chat box.</p>
          </div>
        ) : (
          <div css={simulationListStyle}>
            {simulations.map((simulation: any) => (
              <Card 
                key={simulation.id} 
                css={simulationCardStyle} 
                interactive 
                onClick={() => handleSimulationClick(simulation)}
              >
                <div css={cardHeaderStyle}>
                  <h5>{simulation.name || 'Unnamed Simulation'}</h5>
                  <Button 
                    small
                    minimal
                    intent={Intent.DANGER}
                    icon="trash"
                    onClick={(e) => handleDeleteClick(e, simulation.id)}
                    css={deleteButtonStyle}
                  />
                </div>
                <p>Created: {new Date(simulation.created_at).toLocaleString()}</p>
                {simulation?.actors?.length > 0 && (
                  <p>{simulation.actors.length} actors</p>
                )}
              </Card>
            ))}
          </div>
        )}
        
        {/* Confirmation Dialog */}
        <Dialog
          isOpen={!!simulationToDelete}
          onClose={() => setSimulationToDelete(null)}
          title="Delete Simulation"
          icon="warning-sign"
        >
          <div className={Classes.DIALOG_BODY}>
            <p>Are you sure you want to delete this simulation? This action cannot be undone.</p>
          </div>
          <div className={Classes.DIALOG_FOOTER}>
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
              <Button onClick={() => setSimulationToDelete(null)}>Cancel</Button>
              <Button intent={Intent.DANGER} onClick={handleConfirmDelete}>Delete</Button>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
};

// Styles
const sidebarContainerStyle = css`
  position: fixed;
  top: 0;
  left: 0px;
  padding-left: 42px;
  width: 420px;
  height: 100vh;
  background-color: rgba(0,0,0, 0.8);
  z-index: 1000;
  box-shadow: -4px 0 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  z-index: 1000;

  @media (max-width: 760px) {
    width: 100%;
  }
`;

const sidebarContentStyle = css`
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const sidebarHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  color: white;
`;

const userIdContainerStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  color: #aaa;
  font-size: 11px;
  padding: 4px 8px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
`;

const simulationListStyle = css`
  overflow-y: auto;
  flex: 1;
  
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

const simulationCardStyle = css`
  margin-bottom: 8px;
  background-color: rgba(40, 45, 50, 0.7);
  color: white;
  
  &:hover {
    background-color: rgba(50, 55, 60, 0.8);
  }
  
  h5 {
    margin-top: 0;
    color: white;
  }
  
  p {
    margin: 4px 0;
    font-size: 12px;
    color: #ccc;
  }
`;

const loadingContainerStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: white;
`;

const errorContainerStyle = css`
  margin: 20px 0;
`;

const emptyStateStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: white;
  text-align: center;
  
  p {
    margin: 8px 0;
  }
`;

const cardHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const deleteButtonStyle = css`
  opacity: 0.7;
  
  &:hover {
    opacity: 1;
  }
`;

export default SimulationListSidebar; 