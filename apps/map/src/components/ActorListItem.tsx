import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { Collapse, Icon, Button, EditableText } from '@blueprintjs/core';
import { Actor } from '../services/SimulationService';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useSetAtom } from 'jotai';
import { mapFocusLocationAtom } from '../helpers/states';

interface ActorListItemProps {
  actor: Actor;
  onActorUpdate: (updatedActor: Actor) => void;
  onDelete?: (actorId: string) => void;
}

const ActorListItem: React.FC<ActorListItemProps> = ({ actor, onActorUpdate, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [actorName, setActorName] = useState(actor.name);

  const setMapFocusLocation = useSetAtom(mapFocusLocationAtom);

  // Update local state if actor prop changes externally
  useEffect(() => {
    setActorName(actor.name);
  }, [actor]);

  const toggleAccordion = () => {
    setIsOpen(!isOpen);
  };
  
  const handleCameraFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    let focusCoords: [number, number];
    let focusName: string;

    // Fallback to the first destination
    const firstDest = actor.destinations[0];
    focusName = `${actor.name} (start)`;


    // Focus the map on the actor's position
    setMapFocusLocation({
      latitude: firstDest.latitude,
      longitude: firstDest.longitude,
      name: focusName,
      pitch: 45,
    });
  };

  const handleNameChange = (newName: string) => {
    setActorName(newName);
    onActorUpdate({
      ...actor,
      name: newName
    });
  };



  return (
    <div css={actorItemContainerStyle}>
      <div css={actorItemStyle}>
        <div css={actorMainContentStyle} onClick={toggleAccordion}>
          <div css={actorNameStyle}>{actor.name}</div>
          <Icon icon={isOpen ? "chevron-up" : "chevron-down"} css={chevronStyle} />
        </div>
        <div css={actionButtonsContainerStyle}>
          {onDelete && (
            <Button
              icon="cross"
              minimal={true}
              small={true}
              intent="danger"
              css={deleteButtonStyle}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Are you sure you want to delete ${actor.name}?`)) {
                  onDelete(actor.id);
                }
              }}
              aria-label="Delete actor"
            />
          )}
        </div>
      </div>
      
      {isOpen && (
        <div css={collapseWrapperStyle}>
          <Collapse isOpen={true} css={collapseContentStyle}>
            <Button
              icon="camera"
              minimal={true}
              small={true}
              intent="primary"
              css={cameraButtonStyle}
              onClick={handleCameraFocus}
              aria-label="Focus camera on actor"
            />
            <div css={metadataContainerStyle}>
              <div css={metadataSectionStyle}>
                <div css={metadataLabelStyle}>Name:</div>
                <EditableText
                  value={actorName}
                  onChange={setActorName}
                  onConfirm={handleNameChange}
                  css={editableTextStyle}
                />
              </div>
              
              <div css={metadataSectionStyle}>
                <div css={metadataLabelStyle}>Type:</div>
                <div>{actor.type}</div>
              </div>
              
            </div>
            
            <div css={destinationsContainerStyle}>
              <h4 css={destinationsHeaderStyle}>Route</h4>
              
              {actor.destinations.map((destination, index) => (
                <div key={index} css={destinationItemStyle}>
                  <div css={destinationIconStyle}>
                    <Icon icon="map-marker" />
                  </div>
                  <div css={destinationLabelStyle}>{destination.name}:</div>  
                  <EditableText
                    value={destination.name}
                    onChange={(value) => handleDestinationNameChange(index, value)}
                    onConfirm={(value) => handleDestinationNameChange(index, value)}
                    css={editableTextStyle}
                />
                </div>
              ))}
            </div>
          </Collapse>
        </div>
      )}
    </div>
  );
};

// Helper function to get emoji for actor type
const getActorIcon = (type: string): string => {
  switch (type) {
    case 'truck': return '🚚';
    case 'car': return '🚗';
    case 'sports car': return '🏎️';
    case 'police car': return '🚓';
    case 'taxi': return '🚕';
    case 'bus': return '🚌';
    case 'plane': return '✈️';
    case 'ship': return '🚢';
    case 'fishing boat': return '🚣';
    case 'sailboat': return '⛵';
    case 'yacht': return '🛥️';
    case 'pirate ship': return '🏴‍☠️';
    case 'train': return '🚂';
    case 'freight train': return '🚃';
    case 'high speed train': return '🚄';
    case 'submarine': return '🛳️';
    case 'jeep': return '🚙';
    default: return '🚗';
  }
};

// Styles
const actorItemContainerStyle = css`
  margin-bottom: 8px;
`;

const actorItemStyle = css`
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  justify-content: space-between;
  gap: 4px; 

  &:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }
`;

const actorMainContentStyle = css`
  display: flex;
  align-items: center;
  flex-grow: 1;
  cursor: pointer;
  gap: 4px;
`;

const actorIconStyle = css`
  font-size: 16px;
  width: 20px;
  text-align: center;
`;

const actorNameStyle = css`
  flex-grow: 1;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const deleteButtonStyle = css`
  color: rgba(255, 100, 100, 0.7);
  
  &:hover {
    color: rgba(255, 100, 100, 1);
  }
`;

const actorProgressStyle = css`
  width: 40px;
  height: 8px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  overflow: hidden;
`;

const progressBarStyle = css`
  height: 100%;
  background: linear-gradient(90deg, #48aff0, #2b95d6);
  border-radius: 4px;
  transition: width 0.3s ease;
`;

const chevronStyle = css`
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
`;

const actionButtonsContainerStyle = css`
  display: flex;
  align-items: center;
`;

const cameraButtonStyle = css`
  padding:1px;
`;

const collapseWrapperStyle = css`
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 0 0 8px 8px;
  margin-top: -1px;
  max-height: 600px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }
`;

const collapseContentStyle = css`
  padding: 12px;
`;

const metadataContainerStyle = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
`;

const metadataSectionStyle = css`
  display: flex;
  flex-direction: column;
`;

const metadataLabelStyle = css`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4px;
`;

const editableTextStyle = css`
  color: white;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  padding: 2px 5px;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.5);
  }
`;

const destinationsContainerStyle = css`
  margin-top: 12px;
`;

const destinationsHeaderStyle = css`
  margin: 0 0 8px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
`;

const destinationItemStyle = css`
  display: flex;
  align-items: center;
  padding: 6px;
  margin-bottom: 6px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  flex-wrap: wrap;
`;

const destinationIconStyle = css`
  margin-right: 8px;
  color: #48aff0;
`;

const destinationLabelStyle = css`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-right: 8px;
  width: 70px;
`;

const coordinatesStyle = css`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: auto;
`;

const waypointsContainerStyle = css`
  margin: 8px 0;
`;

const waypointsHeaderStyle = css`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  
  h5 {
    margin: 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }
`;

const waypointsCountStyle = css`
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 10px;
  margin-left: 8px;
`;

const waypointItemStyle = css`
  display: flex;
  align-items: center;
  padding: 4px 6px;
  margin-bottom: 4px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  cursor: grab;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.4);
  }
`;

const waypointIconStyle = css`
  margin-right: 8px;
  color: rgba(255, 255, 255, 0.5);
`;

const waypointCoordinatesStyle = css`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: auto;
`;

export default ActorListItem;
